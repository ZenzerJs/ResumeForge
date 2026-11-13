import { vi } from "vitest";
import { createPrismaMockClient } from "@/lib/db-mock";

const mockPrisma = createPrismaMockClient();

vi.mock("@/lib/prisma", () => ({
  prisma: mockPrisma,
}));

vi.mock("../src/lib/prisma", () => ({
  prisma: mockPrisma,
}));
