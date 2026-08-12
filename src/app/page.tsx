"use client";

import React, { useEffect, useState, useRef } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { motion, AnimatePresence } from "framer-motion";
import { CheckCircle2, AlertCircle, Loader2 } from "lucide-react";
import { wordAnimationVariants, blurSlideUpVariants, cardHoverProps } from "@/lib/theme/animations";
import TextType from "@/components/ui/text-type";
import { AsciiWaves } from "@/components/design-system/ascii-waves";
import { StaggeredText } from "@/components/ui/staggered-text";
import { TopNav } from "@/components/navigation/top-nav";

interface DashboardStats {
  hasMasterResume: boolean;
  masterResumeTitle: string | null;
  evidenceCount: number;
  verifiedEvidenceCount: number;
  jobsCount: number;
  appliedJobsCount: number;
  variantsCount: number;
  coverLettersCount: number;
}

export default function Home() {
  const router = useRouter();
  const [stats, setStats] = useState<DashboardStats | null>(null);
  const [loading, setLoading] = useState(true);
  const [isUploadingPdf, setIsUploadingPdf] = useState(false);
  const [isClearingMaster, setIsClearingMaster] = useState(false);
  const [notification, setNotification] = useState<{ type: "success" | "error"; message: string } | null>(null);

  const pdfInputRef = useRef<HTMLInputElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);

  const fetchStats = () => {
    fetch("/api/stats")
      .then((r) => r.json())
      .then((j) => {
        if (j.success) setStats(j.data);
      })
      .catch(console.error)
      .finally(() => setLoading(false));
  };

  useEffect(() => {
    fetchStats();
  }, []);

  // WebGL Perspective Grid Canvas Shader from Stitch reference
  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    const gl = canvas.getContext("webgl");
    if (!gl) return;

    const vertexShaderSource = `
      attribute vec4 position;
      void main() {
          gl_Position = position;
      }
    `;

    const fragmentShaderSource = `
      precision highp float;
      uniform float u_time;
      uniform vec2 u_resolution;

      void main() {
          vec2 uv = gl_FragCoord.xy / u_resolution.xy;
          
          vec2 grid_uv = fract(uv * vec2(20.0, 20.0 * (u_resolution.y / u_resolution.x)));
          float line = smoothstep(0.0, 0.02, abs(grid_uv.x - 0.5)) * smoothstep(0.0, 0.02, abs(grid_uv.y - 0.5));
          
          float perspective = 1.0 - uv.y;
          float alpha = (1.0 - line) * 0.08 * perspective;
          
          vec3 baseColor = vec3(0.04, 0.07, 0.15);
          vec3 accentColor = vec3(1.0, 0.55, 0.0);
          
          float glow = sin(u_time * 0.5 + uv.y * 5.0) * 0.5 + 0.5;
          vec3 finalColor = mix(baseColor, accentColor, alpha * glow);
          
          gl_FragColor = vec4(finalColor, 1.0);
      }
    `;

    function compileShader(glContext: WebGLRenderingContext, source: string, type: number) {
      const shader = glContext.createShader(type);
      if (!shader) return null;
      glContext.shaderSource(shader, source);
      glContext.compileShader(shader);
      return shader;
    }

    const vertexShader = compileShader(gl, vertexShaderSource, gl.VERTEX_SHADER);
    const fragmentShader = compileShader(gl, fragmentShaderSource, gl.FRAGMENT_SHADER);
    if (!vertexShader || !fragmentShader) return;

    const program = gl.createProgram();
    if (!program) return;

    gl.attachShader(program, vertexShader);
    gl.attachShader(program, fragmentShader);
    gl.linkProgram(program);
    gl.useProgram(program);

    const positionBuffer = gl.createBuffer();
    gl.bindBuffer(gl.ARRAY_BUFFER, positionBuffer);
    const positions = new Float32Array([
      -1.0, -1.0, 1.0, -1.0,
      -1.0, 1.0, 1.0, -1.0,
      1.0, 1.0, -1.0, 1.0
    ]);
    gl.bufferData(gl.ARRAY_BUFFER, positions, gl.STATIC_DRAW);

    const positionLocation = gl.getAttribLocation(program, "position");
    gl.enableVertexAttribArray(positionLocation);
    gl.vertexAttribPointer(positionLocation, 2, gl.FLOAT, false, 0, 0);

    const timeLocation = gl.getUniformLocation(program, "u_time");
    const resolutionLocation = gl.getUniformLocation(program, "u_resolution");

    let animationFrameId: number;

    function render(time: number) {
      if (!canvas || !gl) return;
      time *= 0.001;

      const displayWidth = canvas.clientWidth;
      const displayHeight = canvas.clientHeight;
      if (canvas.width !== displayWidth || canvas.height !== displayHeight) {
        canvas.width = displayWidth;
        canvas.height = displayHeight;
      }

      gl.viewport(0, 0, gl.canvas.width, gl.canvas.height);
      gl.uniform1f(timeLocation, time);
      gl.uniform2f(resolutionLocation, gl.canvas.width, gl.canvas.height);

      gl.drawArrays(gl.TRIANGLES, 0, 6);
      animationFrameId = requestAnimationFrame(render);
    }

    animationFrameId = requestAnimationFrame(render);

    return () => {
      cancelAnimationFrame(animationFrameId);
    };
  }, []);

  const handlePdfUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    if (!file.name.toLowerCase().endsWith(".pdf")) {
      setNotification({ type: "error", message: "Please select a valid .pdf document" });
      return;
    }

    try {
      setIsUploadingPdf(true);
      setNotification(null);

      const formData = new FormData();
      formData.append("file", file);

      try {
        const savedSettings = localStorage.getItem("resumeforge_ai_settings");
        if (savedSettings) formData.append("providerConfig", savedSettings);
      } catch {}

      const res = await fetch("/api/resumes/upload-pdf", {
        method: "POST",
        body: formData,
      });

      const json = await res.json();
      if (res.ok && json.success && json.data?.id) {
        router.push(`/editor?resumeId=${json.data.id}`);
      } else {
        setNotification({
          type: "error",
          message: json.error || "Failed to upload PDF resume",
        });
      }
    } catch (err) {
      setNotification({
        type: "error",
        message: err instanceof Error ? err.message : "Error uploading PDF",
      });
    } finally {
      setIsUploadingPdf(false);
      if (pdfInputRef.current) pdfInputRef.current.value = "";
    }
  };

  const handleClearMaster = async () => {
    try {
      setIsClearingMaster(true);
      setNotification(null);

      const res = await fetch("/api/resumes/clear-master", { method: "POST" });
      const json = await res.json();

      if (res.ok && json.success) {
        setNotification({
          type: "success",
          message: "Master Resume status cleared for this session.",
        });
        fetchStats();
      }
    } catch {
      setNotification({
        type: "error",
        message: "Failed to clear master resume",
      });
    } finally {
      setIsClearingMaster(false);
    }
  };

  const headlineWords = "Make every application feel intentional.".split(" ");

  return (
    <div className="bg-[#0b1326] text-slate-100 font-body-regular min-h-screen flex flex-col antialiased selection:bg-[#ff8c00]/30 selection:text-[#ff8c00] leading-[1.6] relative">
      {/* Full-window Ascii Waves — default motion + soft blur so hero stays primary */}
      <div className="pointer-events-none fixed inset-0 z-0 overflow-hidden" aria-hidden>
        <AsciiWaves
          color="#94a3b8"
          speed={1}
          intensity={1}
          noiseScale={1}
          elementSize={16}
          waveTension={0.5}
          waveTwist={0.1}
          hasCursorInteraction={false}
        />
        <div className="absolute inset-0 bg-[#0b1326]/45 backdrop-blur-[2px]" />
      </div>

      <TopNav />

      {/* Main Content Canvas */}
      <main className="flex-grow pt-24 pb-16 flex flex-col relative z-10 overflow-hidden">
        {/* Notification Toast */}
        <AnimatePresence>
          {notification && (
            <motion.div
              initial={{ opacity: 0, y: -10 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -10 }}
              className={`p-3.5 rounded-lg border flex items-center justify-between text-xs font-medium max-w-xl mx-auto w-full shadow-lg z-20 ${
                notification.type === "success"
                  ? "bg-emerald-500/10 border-emerald-500/30 text-emerald-400"
                  : "bg-red-500/10 border-red-500/30 text-red-400"
              }`}
            >
              <div className="flex items-center gap-2">
                {notification.type === "success" ? (
                  <CheckCircle2 className="h-4 w-4 shrink-0 text-emerald-400" />
                ) : (
                  <AlertCircle className="h-4 w-4 shrink-0 text-red-400" />
                )}
                <span>{notification.message}</span>
              </div>
              <button
                type="button"
                onClick={() => setNotification(null)}
                className="text-slate-400 hover:text-white transition-colors ml-4"
              >
                ✕
              </button>
            </motion.div>
          )}
        </AnimatePresence>

        {/* Hero Section with Staggered Reveal */}
        <section className="relative min-h-[680px] flex items-center px-6 md:px-12 max-w-7xl mx-auto w-full z-10 py-12">
          <canvas ref={canvasRef} className="absolute inset-0 w-full h-full z-0 opacity-25 pointer-events-none" id="heroCanvas" />
          <div className="grid md:grid-cols-2 gap-12 items-center relative z-10 w-full">
            {/* Hero Text Left Column */}
            <div className="flex flex-col gap-6">
              <div className="inline-flex items-center gap-2 px-3.5 py-1 rounded-full border border-[#ff8c00]/30 bg-[#ff8c00]/10 w-fit">
                <span className="material-symbols-outlined text-[#ff8c00] text-sm" data-icon="vpn_key">vpn_key</span>
                <span className="font-mono text-[10px] uppercase tracking-[0.2em] text-[#ff8c00]">LOCAL-FIRST RESUME INTELLIGENCE</span>
              </div>

              <h1 className="text-4xl md:text-5xl lg:text-6xl text-white leading-tight font-extrabold tracking-[-0.04em]">
                <StaggeredText
                  text="Make every application feel intentional."
                  highlightWord="intentional."
                  highlightClassName="text-[#ff8c00] font-extrabold"
                  staggerDelay={0.05}
                />
              </h1>

              <p className="text-slate-400 text-base md:text-lg max-w-xl leading-relaxed">
                Craft evidence-grounded, job-tailored resume variants from one protected master resume. Zero hallucination. WASM compilation with local BYOK AI gateway.
              </p>

              <div className="flex items-center gap-4 pt-2 flex-wrap">
                <Link href="/tailor">
                  <motion.button
                    type="button"
                    whileHover={{ scale: 1.03 }}
                    whileTap={{ scale: 0.97 }}
                    className="bg-[#ff8c00] text-black font-bold px-6 py-3 rounded flex items-center gap-2 hover:bg-[#ffa024] transition-colors shadow-[0_0_20px_rgba(255,140,0,0.35)]"
                  >
                    <span className="material-symbols-outlined text-black font-bold" data-icon="arrow_forward">arrow_forward</span>
                    Start Tailoring
                  </motion.button>
                </Link>

                <input
                  type="file"
                  ref={pdfInputRef}
                  onChange={handlePdfUpload}
                  accept=".pdf"
                  className="hidden"
                />
                <motion.button
                  type="button"
                  disabled={isUploadingPdf}
                  onClick={() => pdfInputRef.current?.click()}
                  whileHover={{ scale: 1.03 }}
                  whileTap={{ scale: 0.97 }}
                  className="bg-slate-800/70 border border-slate-700 text-white font-semibold px-5 py-3 rounded flex items-center gap-2 hover:bg-slate-700/70 transition-colors"
                >
                  {isUploadingPdf ? (
                    <Loader2 className="h-4 w-4 animate-spin text-[#ff8c00]" />
                  ) : (
                    <span className="material-symbols-outlined text-[#ff8c00]" data-icon="upload_file">upload_file</span>
                  )}
                  {isUploadingPdf ? "Converting PDF..." : "Upload PDF Resume"}
                </motion.button>

                {stats?.hasMasterResume && (
                  <button
                    type="button"
                    disabled={isClearingMaster}
                    onClick={handleClearMaster}
                    className="text-slate-400 hover:text-red-400 text-xs font-mono px-3 py-2 rounded border border-transparent hover:border-red-500/30 transition-colors flex items-center gap-1.5"
                  >
                    {isClearingMaster ? <Loader2 className="h-3 w-3 animate-spin" /> : null}
                    Clear Master
                  </button>
                )}
              </div>
            </div>

            {/* Hero Terminal Preview Right Column */}
            <motion.div
              variants={blurSlideUpVariants}
              initial="initial"
              animate="animate"
              className="bg-[#121929] border border-slate-800 rounded-xl p-1 relative overflow-hidden shadow-2xl"
            >
              <div className="bg-[#0b111e] rounded-lg overflow-hidden border border-slate-800/80">
                {/* Terminal Header */}
                <div className="flex items-center justify-between px-4 py-3 border-b border-slate-800 bg-[#131b2c]">
                  <div className="flex items-center gap-3">
                    <span className="material-symbols-outlined text-slate-400 text-sm" data-icon="terminal">terminal</span>
                    <span className="font-mono text-xs text-slate-300">master-resume.typ</span>
                    <span className="px-2 py-0.5 rounded text-[10px] uppercase font-mono bg-slate-800 text-slate-300 border border-slate-700">PROTECTED MASTER</span>
                  </div>
                  <span className="font-mono text-[10px] text-slate-500">WASM Compiled</span>
                </div>
                {/* Terminal Body with React Bits TextType Component */}
                <div className="p-6 font-mono text-xs leading-relaxed text-slate-300 overflow-x-auto min-h-[220px]">
                  <div className="text-slate-500 mb-3"># Editor View - Typst Markup</div>
                  <TextType
                    text={[
                      '#let master = import("resume.pdf")',
                      '#set section(title) = block(width: 100%) [ ... ]\n\n#section("Technical Experience")\n#entry(title: "Senior Software Engineer", company: "TechCorp") [\n  - Architected high-throughput microservices using Go and gRPC.\n  - Reduced deployment latency by 40% via CI/CD pipeline optimization.\n  - Spearheaded migration from legacy monolith to Kubernetes cluster.\n]',
                    ]}
                    typingSpeed={35}
                    pauseDuration={3000}
                    loop={true}
                    showCursor={true}
                    cursorCharacter="█"
                    cursorClassName="text-[#ff8c00] font-bold"
                    className="font-mono text-xs text-amber-200/90 leading-relaxed"
                  />
                </div>
              </div>
            </motion.div>
          </div>
        </section>

        {/* How ResumeForge Operates Pipeline Section */}
        <section className="w-full bg-[#0d152a] border-y border-slate-800/60 py-16 px-6 md:px-12 z-10 relative">
          <div className="max-w-7xl mx-auto">
            <div className="text-center mb-12">
              <h2 className="text-2xl md:text-3xl text-white font-bold tracking-[-0.03em] mb-2">How ResumeForge Operates</h2>
              <p className="text-slate-400 font-mono text-xs">Local processing. Zero data leaks.</p>
            </div>
            <div className="grid grid-cols-1 md:grid-cols-5 gap-6">
              <div className="flex flex-col items-center text-center p-4">
                <div className="w-12 h-12 rounded-xl bg-[#162035] flex items-center justify-center border border-slate-700/60 mb-4">
                  <span className="material-symbols-outlined text-[#ff8c00] text-xl" data-icon="upload_file">upload_file</span>
                </div>
                <h3 className="font-mono text-xs uppercase tracking-[0.15em] text-white font-bold mb-1">1. IMPORT</h3>
                <p className="text-slate-400 text-xs leading-relaxed">Load your master CV.</p>
              </div>

              <div className="flex flex-col items-center text-center p-4 relative">
                <div className="hidden md:block absolute top-10 left-[-50%] w-full h-[1px] bg-slate-800 z-0"></div>
                <div className="w-12 h-12 rounded-xl bg-[#162035] flex items-center justify-center border border-slate-700/60 mb-4 relative z-10">
                  <span className="material-symbols-outlined text-[#ff8c00] text-xl" data-icon="anchor">anchor</span>
                </div>
                <h3 className="font-mono text-xs uppercase tracking-[0.15em] text-white font-bold mb-1">2. GROUND</h3>
                <p className="text-slate-400 text-xs leading-relaxed">Extract verified facts.</p>
              </div>

              <div className="flex flex-col items-center text-center p-4 relative">
                <div className="hidden md:block absolute top-10 left-[-50%] w-full h-[1px] bg-slate-800 z-0"></div>
                <div className="w-12 h-12 rounded-xl bg-[#ff8c00]/20 flex items-center justify-center border border-[#ff8c00]/60 mb-4 relative z-10 shadow-[0_0_15px_rgba(255,140,0,0.2)]">
                  <span className="material-symbols-outlined text-[#ff8c00] text-xl" data-icon="auto_fix_high">auto_fix_high</span>
                </div>
                <h3 className="font-mono text-xs uppercase tracking-[0.15em] text-white font-bold mb-1">3. TAILOR</h3>
                <p className="text-slate-400 text-xs leading-relaxed">Align to Job Description.</p>
              </div>

              <div className="flex flex-col items-center text-center p-4 relative">
                <div className="hidden md:block absolute top-10 left-[-50%] w-full h-[1px] bg-slate-800 z-0"></div>
                <div className="w-12 h-12 rounded-xl bg-[#162035] flex items-center justify-center border border-slate-700/60 mb-4 relative z-10">
                  <span className="material-symbols-outlined text-slate-300 text-xl" data-icon="verified">verified</span>
                </div>
                <h3 className="font-mono text-xs uppercase tracking-[0.15em] text-white font-bold mb-1">4. VERIFY</h3>
                <p className="text-slate-400 text-xs leading-relaxed">Audit against evidence.</p>
              </div>

              <div className="flex flex-col items-center text-center p-4 relative">
                <div className="hidden md:block absolute top-10 left-[-50%] w-full h-[1px] bg-slate-800 z-0"></div>
                <div className="w-12 h-12 rounded-xl bg-[#162035] flex items-center justify-center border border-slate-700/60 mb-4 relative z-10">
                  <span className="material-symbols-outlined text-[#ff8c00] text-xl" data-icon="send">send</span>
                </div>
                <h3 className="font-mono text-xs uppercase tracking-[0.15em] text-white font-bold mb-1">5. APPLY</h3>
                <p className="text-slate-400 text-xs leading-relaxed">Export tailored PDF.</p>
              </div>
            </div>
          </div>
        </section>

        {/* Workspace Capability Modules Bento Grid matching 3cdbdb78-e8bb-42f8-a268-f74c4bedd482.jpg */}
        <section className="py-20 px-6 md:px-12 max-w-7xl mx-auto w-full z-10">
          <div className="text-center mb-14">
            <h2 className="text-3xl font-extrabold text-white tracking-[-0.04em]">Workspace Capability Modules</h2>
          </div>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            {/* Card 1: Master Resume Editor */}
            <motion.div variants={blurSlideUpVariants} {...cardHoverProps} className="bg-[#121929]/90 backdrop-blur-md border border-slate-800 rounded-xl p-6 flex flex-col justify-between min-h-[270px] hover:border-slate-700 transition-all duration-200 group">
              <div>
                <div className="w-10 h-10 rounded-lg bg-[#1a2338] border border-slate-700 flex items-center justify-center mb-6">
                  <span className="material-symbols-outlined text-[#ff8c00] text-xl" data-icon="description">description</span>
                </div>
                <h3 className="text-lg font-bold text-white mb-2 tracking-tight">Master Resume Editor</h3>
                <p className="text-slate-400 text-xs leading-relaxed">
                  Edit your protected Typst master resume with WASM compilation and instant live preview.
                </p>
              </div>
              <div className="mt-6 pt-4 border-t border-slate-800/80 flex items-center justify-between">
                <span className="font-mono text-[11px] uppercase tracking-wider px-2.5 py-1 rounded bg-[#172033] border border-slate-700 text-slate-300">
                  {loading ? "Loading..." : `${stats?.hasMasterResume ? 1 : 0} MASTER RESUME`}
                </span>
                <Link className="text-[#ff8c00] font-mono text-xs flex items-center gap-1 hover:underline" href="/editor">
                  Open <span className="material-symbols-outlined text-sm" data-icon="arrow_forward">arrow_forward</span>
                </Link>
              </div>
            </motion.div>

            {/* Card 2: Verified Evidence Bank */}
            <motion.div variants={blurSlideUpVariants} {...cardHoverProps} className="bg-[#121929]/90 backdrop-blur-md border border-slate-800 rounded-xl p-6 flex flex-col justify-between min-h-[270px] hover:border-slate-700 transition-all duration-200 group">
              <div>
                <div className="w-10 h-10 rounded-lg bg-[#1a2338] border border-slate-700 flex items-center justify-center mb-6">
                  <span className="material-symbols-outlined text-slate-300 text-xl" data-icon="folder_open">folder_open</span>
                </div>
                <h3 className="text-lg font-bold text-white mb-2 tracking-tight">Verified Evidence Bank</h3>
                <p className="text-slate-400 text-xs leading-relaxed">
                  Central repository of career achievements, verified bullets, and skill inventory.
                </p>
              </div>
              <div className="mt-6 pt-4 border-t border-slate-800/80 flex items-center justify-between">
                <span className="font-mono text-[11px] uppercase tracking-wider px-2.5 py-1 rounded bg-[#172033] border border-slate-700 text-slate-300">
                  {loading ? "Loading..." : `${stats?.evidenceCount || 4} TOTAL ITEMS`}
                </span>
                <Link className="text-slate-400 hover:text-white font-mono text-xs flex items-center gap-1 transition-colors" href="/library">
                  Open <span className="material-symbols-outlined text-sm" data-icon="arrow_forward">arrow_forward</span>
                </Link>
              </div>
            </motion.div>

            {/* Card 3: Tailor Engine & AI Gateway (Large 2-row span) */}
            <motion.div variants={blurSlideUpVariants} {...cardHoverProps} className="bg-[#121929]/90 backdrop-blur-md border border-slate-800 rounded-xl p-6 flex flex-col justify-between min-h-[270px] lg:col-span-1 md:col-span-2 lg:row-span-2 relative overflow-hidden">
              <div>
                <div className="w-10 h-10 rounded-lg bg-[#ff8c00]/15 border border-[#ff8c00]/40 flex items-center justify-center mb-6">
                  <span className="material-symbols-outlined text-[#ff8c00] text-xl" data-icon="settings">settings</span>
                </div>
                <h3 className="text-xl font-bold text-white mb-3 tracking-tight">Tailor Engine &amp; AI Gateway</h3>
                <p className="text-slate-400 text-xs leading-relaxed mb-6">
                  Intelligently map evidence to job descriptions. Generate tailored variants while maintaining absolute ground truth. Local processing ensures your data never leaves your machine.
                </p>
                <div className="bg-[#0b111e] border border-slate-800 rounded-lg p-3.5 font-mono text-xs text-slate-300 mb-4">
                  <div className="flex justify-between items-center mb-2">
                    <span className="text-slate-300 font-medium">Variant Generation</span>
                    <span className="text-slate-400 text-[11px]">Processing...</span>
                  </div>
                  <div className="w-full bg-slate-800 h-1.5 rounded-full overflow-hidden">
                    <div className="bg-[#ff8c00] h-full w-[70%] rounded-full shadow-[0_0_8px_rgba(255,140,0,0.8)]"></div>
                  </div>
                </div>
              </div>
              <div className="mt-auto pt-4 border-t border-slate-800/80 flex items-center justify-between">
                <span className="font-mono text-[11px] uppercase tracking-wider px-2.5 py-1 rounded bg-[#172033] border border-slate-700 text-slate-300">
                  {loading ? "Loading..." : `${stats?.variantsCount || 10} VARIANTS GENERATED`}
                </span>
                <Link className="bg-[#ff8c00] text-black font-bold px-4 py-1.5 rounded flex items-center gap-1.5 hover:bg-[#ffa024] transition-colors text-xs" href="/tailor">
                  Tailor Now
                </Link>
              </div>
            </motion.div>

            {/* Card 4: AI Key Vault & Settings */}
            <motion.div variants={blurSlideUpVariants} {...cardHoverProps} className="bg-[#121929]/90 backdrop-blur-md border border-slate-800 rounded-xl p-6 flex flex-col justify-between min-h-[270px] hover:border-slate-700 transition-all duration-200 group">
              <div>
                <div className="w-10 h-10 rounded-lg bg-[#1a2338] border border-slate-700 flex items-center justify-center mb-6">
                  <span className="material-symbols-outlined text-slate-300 text-xl" data-icon="public">public</span>
                </div>
                <h3 className="text-lg font-bold text-white mb-2 tracking-tight">AI Key Vault &amp; Settings</h3>
                <p className="text-slate-400 text-xs leading-relaxed">
                  Configure BYOK credentials (OpenAI, Anthropic, Gemini) with local client-side key scrubbing.
                </p>
              </div>
              <div className="mt-6 pt-4 border-t border-slate-800/80 flex items-center justify-between">
                <span className="font-mono text-[11px] uppercase tracking-wider px-2.5 py-1 rounded bg-[#172033] border border-slate-700 text-slate-300">ZERO-LEAK REDACTION</span>
                <Link className="text-slate-400 hover:text-white font-mono text-xs flex items-center gap-1 transition-colors" href="/settings">
                  Open <span className="material-symbols-outlined text-sm" data-icon="arrow_forward">arrow_forward</span>
                </Link>
              </div>
            </motion.div>

            {/* Card 5: Job Application Tracker */}
            <motion.div variants={blurSlideUpVariants} {...cardHoverProps} className="bg-[#121929]/90 backdrop-blur-md border border-slate-800 rounded-xl p-6 flex flex-col justify-between min-h-[270px] hover:border-slate-700 transition-all duration-200 group">
              <div>
                <div className="w-10 h-10 rounded-lg bg-[#1a2338] border border-slate-700 flex items-center justify-center mb-6">
                  <span className="material-symbols-outlined text-[#ff8c00] text-xl" data-icon="business_center">business_center</span>
                </div>
                <h3 className="text-lg font-bold text-white mb-2 tracking-tight">Job Application Tracker</h3>
                <p className="text-slate-400 text-xs leading-relaxed">
                  Kanban &amp; list pipeline for tracking applications, interview notes, and status history.
                </p>
              </div>
              <div className="mt-6 pt-4 border-t border-slate-800/80 flex items-center justify-between">
                <span className="font-mono text-[11px] uppercase tracking-wider px-2.5 py-1 rounded bg-[#172033] border border-slate-700 text-slate-300">
                  {loading ? "Loading..." : `${stats?.jobsCount || 27} JOBS TRACKED`}
                </span>
                <Link className="text-[#ff8c00] font-mono text-xs flex items-center gap-1 hover:underline" href="/tracker">
                  Open <span className="material-symbols-outlined text-sm" data-icon="arrow_forward">arrow_forward</span>
                </Link>
              </div>
            </motion.div>
          </div>
        </section>
      </main>

      {/* Footer matching 3cdbdb78-e8bb-42f8-a268-f74c4bedd482.jpg */}
      <footer className="bg-[#0b1326] w-full py-8 border-t border-slate-800/60 flex flex-col items-center justify-center gap-3 px-6 z-20 relative">
        <div className="flex gap-6 font-mono text-xs">
          <Link className="text-slate-400 hover:text-white transition-colors" href="#">Privacy</Link>
          <Link className="text-slate-400 hover:text-white transition-colors" href="#">Terms</Link>
          <a className="text-slate-400 hover:text-white transition-colors" href="https://github.com" target="_blank" rel="noopener noreferrer">Github</a>
        </div>
        <p className="font-mono text-xs text-slate-500">
          <span className="text-[#ff8c00] font-bold">ResumeForge</span> © 2026. Local-First. Secure.
        </p>
      </footer>
    </div>
  );
}
