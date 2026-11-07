import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import type { LookupAddress } from "node:dns";
import type { LookupFunction } from "node:net";
import { safeFetch, UnsafeUrlError } from "@/lib/security/safe-fetch";

const network = vi.hoisted(() => ({
  lookup: vi.fn(),
  socketLookup: undefined as LookupFunction | undefined,
}));

vi.mock("node:dns", () => ({ lookup: network.lookup }));
vi.mock("undici", async (importOriginal) => {
  const actual = await importOriginal<typeof import("undici")>();
  return { ...actual, Agent: class extends actual.Agent {
    constructor(options: { connect: { lookup: LookupFunction } }) {
      super(options);
      network.socketLookup = options.connect.lookup;
    }
  } };
});

describe("safeFetch socket DNS validation", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.spyOn(globalThis, "fetch").mockResolvedValue(new Response("ok"));
  });

  afterEach(() => vi.restoreAllMocks());

  function resolveAddresses(addresses: LookupAddress[], all = true) {
    network.lookup.mockImplementationOnce((_host, _options, callback) => callback(null, addresses));
    const callback = vi.fn();
    network.socketLookup!("rebind.example", { all }, callback);
    return callback;
  }

  it.each([
    [{ address: "127.0.0.1", family: 4 }],
    [{ address: "10.0.0.1", family: 4 }],
    [{ address: "::ffff:127.0.0.1", family: 6 }],
    [{ address: "fd00::1", family: 6 }],
    [{ address: "8.8.8.8", family: 4 }, { address: "::1", family: 6 }],
    [],
  ])("rejects private, mixed, or empty DNS results: %j", (...addresses) => {
    const callback = resolveAddresses(addresses);
    expect(callback).toHaveBeenCalledWith(expect.any(UnsafeUrlError), "", 0);
  });

  it("passes exactly the checked addresses to the socket without a second lookup", () => {
    const addresses = [
      { address: "8.8.8.8", family: 4 },
      { address: "2001:4860:4860::8888", family: 6 },
    ];
    expect(resolveAddresses(addresses)).toHaveBeenCalledWith(null, addresses);
    expect(network.lookup).toHaveBeenCalledOnce();
    expect(network.lookup).toHaveBeenCalledWith("rebind.example", { all: true }, expect.any(Function));
  });

  it("supports the single-address socket callback", () => {
    expect(resolveAddresses([{ address: "8.8.8.8", family: 4 }], false))
      .toHaveBeenCalledWith(null, "8.8.8.8", 4);
  });

  it("fails closed on DNS errors", () => {
    const error = new Error("DNS unavailable");
    network.lookup.mockImplementationOnce((_host, _options, callback) => callback(error));
    const callback = vi.fn();
    network.socketLookup!("rebind.example", {}, callback);
    expect(callback).toHaveBeenCalledWith(error, "", 0);
  });

  it("blocks private DNS results through the real Node fetch transport before connection", async () => {
    vi.mocked(fetch).mockRestore();
    network.lookup.mockImplementationOnce((_host, _options, callback) => {
      callback(null, [{ address: "127.0.0.1", family: 4 }]);
    });
    await expect(safeFetch("https://rebind.example/", {}, { allowLocalhost: false }))
      .rejects.toMatchObject({ cause: { name: "UnsafeUrlError" } });
    expect(network.lookup).toHaveBeenCalledOnce();
  });

  it("uses the guarded dispatcher on every public redirect hop", async () => {
    vi.mocked(fetch)
      .mockResolvedValueOnce(new Response(null, { status: 302, headers: { location: "https://next.example/" } }))
      .mockResolvedValueOnce(new Response("ok"));
    await safeFetch("https://first.example/", {}, { followRedirects: true, allowLocalhost: false });
    expect(fetch).toHaveBeenCalledTimes(2);
    for (const [, init] of vi.mocked(fetch).mock.calls) {
      expect(init).toEqual(expect.objectContaining({ dispatcher: expect.any(Object), redirect: "manual" }));
    }
  });

  it("rejects mapped private redirect destinations before requesting them", async () => {
    vi.mocked(fetch).mockResolvedValueOnce(new Response(null, {
      status: 302,
      headers: { location: "https://[::ffff:127.0.0.1]/" },
    }));
    await expect(safeFetch("https://first.example/", {}, { followRedirects: true, allowLocalhost: false }))
      .rejects.toBeInstanceOf(UnsafeUrlError);
    expect(fetch).toHaveBeenCalledOnce();
  });

  it("releases the parent abort listener after completion", async () => {
    const controller = new AbortController();
    const add = vi.spyOn(controller.signal, "addEventListener");
    const remove = vi.spyOn(controller.signal, "removeEventListener");
    await safeFetch("https://public.example/", { signal: controller.signal });
    expect(remove).toHaveBeenCalledWith("abort", add.mock.calls[0][1]);
  });
});
