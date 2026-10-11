import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { QRCodeSVG } from 'qrcode.react';
import {
  Leaf,
  LayoutDashboard,
  Smartphone,
  Download,
  ExternalLink,
  ShieldCheck,
  Cpu,
  MapPin,
  Flame,
  Award,
  Zap,
  CheckCircle2,
  Copy,
  Check,
  Radio,
  ArrowRight,
  Sparkles,
  Terminal,
  Globe,
  Layers,
} from 'lucide-react';

export const WelcomePage: React.FC = () => {
  const navigate = useNavigate();
  const [copiedLink, setCopiedLink] = useState(false);
  const [activeTab, setActiveTab] = useState<'expo' | 'apk' | 'expogo'>('expo');

  const EXPO_BUILD_PAGE =
    'https://expo.dev/accounts/gurukant001/projects/ecopulse/builds/2f8ac231-a511-4d12-be7a-d317bdef1729';
  const DIRECT_APK_URL =
    'https://expo.dev/artifacts/eas/ywPLbPRR-KNSh6QcVXOhE-DazxSTvC7ZZYKMcz0Hq6A.apk';
  const S3_APK_URL =
    'https://ecopulse-evidence-dev.s3.ap-southeast-2.amazonaws.com/downloads/ecopulse.apk?X-Amz-Algorithm=AWS4-HMAC-SHA256&X-Amz-Content-Sha256=UNSIGNED-PAYLOAD&X-Amz-Credential=AKIA2T6BFPXCOJ365XUC%2F20261011%2Fap-southeast-2%2Fs3%2Faws4_request&X-Amz-Date=20261011T151150Z&X-Amz-Expires=604800&X-Amz-Signature=0f2b863231af7c4ebe9881f1cdb571b0ef90820b7b2498cd9d6dd2544e1f5722&X-Amz-SignedHeaders=host&x-amz-checksum-mode=ENABLED&x-id=GetObject';
  const EXPO_GO_URL = 'exp://10.184.0.99:8081';

  const copyToClipboard = (text: string) => {
    navigator.clipboard.writeText(text);
    setCopiedLink(true);
    setTimeout(() => setCopiedLink(false), 2000);
  };

  const scrollToDownload = () => {
    document.getElementById('download-section')?.scrollIntoView({ behavior: 'smooth' });
  };

  return (
    <div className="min-h-screen bg-[#070D0A] text-slate-100 font-sans selection:bg-emerald-500 selection:text-black">
      {/* Brutalist Top Alert Ticker */}
      <div className="border-b-2 border-emerald-500/30 bg-[#0B1A14] px-4 py-2 text-xs font-mono flex items-center justify-between text-emerald-400">
        <div className="flex items-center gap-3">
          <span className="flex items-center gap-1.5 font-bold uppercase tracking-wider">
            <span className="w-2 h-2 rounded-full bg-emerald-400 animate-ping inline-block" />
            LIVE SYSTEM GRID
          </span>
          <span className="hidden md:inline text-slate-400">|</span>
          <span className="hidden md:inline text-slate-300">
            PUNE MUNICIPAL CORPORATION // CLOUD RADAR ACTIVE
          </span>
        </div>
        <div className="flex items-center gap-4 text-[11px] text-slate-400">
          <span className="hidden sm:inline">AWS REGION: ap-southeast-2</span>
          <span className="px-1.5 py-0.5 bg-emerald-500/10 border border-emerald-500/40 text-emerald-300 rounded font-bold">
            v0.1.0-PREVIEW
          </span>
        </div>
      </div>

      {/* Main Navigation Header */}
      <header className="sticky top-0 z-40 bg-[#070D0A]/95 backdrop-blur-md border-b-2 border-black/40">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 h-20 flex items-center justify-between">
          {/* Logo / Brand */}
          <div className="flex items-center gap-3.5">
            <div className="w-11 h-11 bg-emerald-400 border-2 border-black shadow-[3px_3px_0px_#000] flex items-center justify-center text-black font-black">
              <Leaf className="w-6 h-6 stroke-[2.5]" />
            </div>
            <div>
              <div className="text-xl font-black tracking-tight font-mono text-white flex items-center gap-2">
                ECOPULSE
                <span className="text-[10px] bg-black border border-emerald-500/50 text-emerald-400 px-1.5 py-0.5 font-mono font-bold tracking-widest uppercase">
                  MUNICIPAL
                </span>
              </div>
              <p className="text-[11px] text-slate-400 font-mono tracking-tight">
                Planetary Environmental Intelligence
              </p>
            </div>
          </div>

          {/* Action CTAs */}
          <div className="flex items-center gap-3 sm:gap-4">
            <button
              onClick={scrollToDownload}
              className="px-3.5 sm:px-4 py-2.5 bg-[#0F241C] border-2 border-emerald-500/40 text-emerald-300 hover:text-white hover:bg-[#153428] hover:border-emerald-400 font-mono text-xs font-bold uppercase transition-all shadow-[3px_3px_0px_#042F24] active:translate-x-0.5 active:translate-y-0.5 active:shadow-none flex items-center gap-2"
            >
              <Smartphone className="w-4 h-4 text-emerald-400" />
              <span className="hidden sm:inline">Get Mobile</span> App
            </button>

            <button
              onClick={() => navigate('/operations')}
              className="px-4 sm:px-6 py-2.5 bg-emerald-400 hover:bg-emerald-300 text-black border-2 border-black font-mono text-xs sm:text-sm font-black uppercase tracking-wider transition-all shadow-[4px_4px_0px_#000] hover:shadow-[5px_5px_0px_#000] active:translate-x-0.5 active:translate-y-0.5 active:shadow-none flex items-center gap-2"
            >
              <LayoutDashboard className="w-4 h-4 stroke-[2.5]" />
              <span>Open Dashboard</span>
              <ArrowRight className="w-4 h-4 stroke-[2.5]" />
            </button>
          </div>
        </div>
      </header>

      {/* Hero Section */}
      <section className="relative pt-12 pb-20 px-4 sm:px-6 lg:px-8 max-w-7xl mx-auto overflow-hidden">
        {/* Subtle Brutalist grid accents */}
        <div className="absolute top-0 right-0 -z-10 opacity-15 pointer-events-none">
          <div className="w-96 h-96 border-4 border-dashed border-emerald-500 rounded-full blur-3xl" />
        </div>

        <div className="max-w-4xl">
          {/* Eyebrow Tag */}
          <div className="inline-flex items-center gap-2 px-3 py-1 bg-[#0E291E] border-2 border-emerald-500/60 shadow-[3px_3px_0px_#042F24] mb-6">
            <Radio className="w-3.5 h-3.5 text-emerald-400 animate-pulse" />
            <span className="text-xs font-mono font-bold tracking-widest text-emerald-300 uppercase">
              Autonomous Municipal Operations Center
            </span>
          </div>

          {/* Main Title */}
          <h1 className="text-4xl sm:text-6xl lg:text-7xl font-black tracking-tight uppercase leading-[0.95] text-white mb-6">
            PUNE ENVIRONMENTAL{' '}
            <span className="text-emerald-400 underline decoration-4 decoration-emerald-500/50 underline-offset-8">
              INTELLIGENCE
            </span>{' '}
            & CITIZEN RADAR.
          </h1>

          {/* Subtitle */}
          <p className="text-base sm:text-lg text-slate-300 max-w-2xl font-normal leading-relaxed mb-8 border-l-4 border-emerald-500 pl-4 bg-[#091510]/50 py-1">
            Empowering residents and municipal field crews with real-time hazard detection,
            multimodal vision verification, geospatial hotspot radar, and direct civic rewards.
          </p>

          {/* Primary Action Buttons */}
          <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-4 pt-2 pb-12">
            <button
              onClick={() => navigate('/operations')}
              className="group px-7 py-4 bg-emerald-400 hover:bg-emerald-300 text-black border-2 border-black font-mono text-base font-black uppercase tracking-wider transition-all shadow-[6px_6px_0px_#000] hover:shadow-[7px_7px_0px_#000] active:translate-x-1 active:translate-y-1 active:shadow-none flex items-center justify-center gap-3"
            >
              <LayoutDashboard className="w-5 h-5 stroke-[2.5]" />
              <span>Launch Operations Dashboard</span>
              <ArrowRight className="w-5 h-5 stroke-[2.5] group-hover:translate-x-1 transition-transform" />
            </button>

            <button
              onClick={scrollToDownload}
              className="px-6 py-4 bg-[#0F291E] hover:bg-[#163B2C] text-emerald-300 hover:text-white border-2 border-emerald-500/60 font-mono text-base font-bold uppercase tracking-wider transition-all shadow-[5px_5px_0px_#042F24] active:translate-x-1 active:translate-y-1 active:shadow-none flex items-center justify-center gap-3"
            >
              <Smartphone className="w-5 h-5 text-emerald-400" />
              <span>Download Mobile Client (Expo)</span>
              <Download className="w-4 h-4 text-emerald-400" />
            </button>
          </div>

          {/* 4 Brutalist Telemetry Metrics */}
          <div className="grid grid-cols-2 md:grid-cols-4 gap-3 pt-4 border-t-2 border-slate-800">
            <div className="bg-[#0B1A14] border-2 border-black p-3.5 shadow-[3px_3px_0px_#000]">
              <div className="text-[10px] font-mono text-slate-400 uppercase tracking-wider">
                01 // HOTSPOTS
              </div>
              <div className="text-xl font-black font-mono text-white mt-1">24 ACTIVE</div>
              <div className="text-[11px] text-emerald-400 font-mono mt-0.5">Pune Spatial Grid</div>
            </div>

            <div className="bg-[#0B1A14] border-2 border-black p-3.5 shadow-[3px_3px_0px_#000]">
              <div className="text-[10px] font-mono text-slate-400 uppercase tracking-wider">
                02 // VISION SPEED
              </div>
              <div className="text-xl font-black font-mono text-white mt-1">1.13 SEC</div>
              <div className="text-[11px] text-emerald-400 font-mono mt-0.5">Gemini 3.5 Flash</div>
            </div>

            <div className="bg-[#0B1A14] border-2 border-black p-3.5 shadow-[3px_3px_0px_#000]">
              <div className="text-[10px] font-mono text-slate-400 uppercase tracking-wider">
                03 // CLOUD VAULT
              </div>
              <div className="text-xl font-black font-mono text-white mt-1">AWS S3</div>
              <div className="text-[11px] text-emerald-400 font-mono mt-0.5">AES-256 Evidence</div>
            </div>

            <div className="bg-[#0B1A14] border-2 border-black p-3.5 shadow-[3px_3px_0px_#000]">
              <div className="text-[10px] font-mono text-slate-400 uppercase tracking-wider">
                04 // CITIZEN IMPACT
              </div>
              <div className="text-xl font-black font-mono text-white mt-1">100% REWARDED</div>
              <div className="text-[11px] text-emerald-400 font-mono mt-0.5">Vouchers & Badges</div>
            </div>
          </div>
        </div>
      </section>

      {/* Dedicated App Download Station (Expo & APK) */}
      <section id="download-section" className="py-16 bg-[#0A1712] border-y-4 border-black">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          {/* Section Header */}
          <div className="flex flex-col md:flex-row md:items-end justify-between mb-10 gap-4">
            <div>
              <div className="inline-flex items-center gap-1.5 px-2.5 py-0.5 bg-black border border-emerald-500/40 text-emerald-400 text-xs font-mono font-bold uppercase mb-2">
                <Smartphone className="w-3.5 h-3.5" />
                OFFICIAL MOBILE DEPLOYMENT
              </div>
              <h2 className="text-3xl sm:text-5xl font-black uppercase text-white tracking-tight">
                GET THE CITIZEN APPLICATION
              </h2>
              <p className="text-slate-300 text-sm sm:text-base mt-2 max-w-xl">
                Install EcoPulse directly onto your Android device to capture geotagged evidence,
                discover local environmental hotspots, and claim rewards.
              </p>
            </div>

            {/* Tab switcher */}
            <div className="flex bg-[#050D0A] border-2 border-black p-1 shadow-[3px_3px_0px_#000]">
              <button
                onClick={() => setActiveTab('expo')}
                className={`px-3 py-1.5 font-mono text-xs font-bold uppercase transition-all ${
                  activeTab === 'expo'
                    ? 'bg-emerald-400 text-black border border-black shadow-[2px_2px_0px_#000]'
                    : 'text-slate-400 hover:text-white'
                }`}
              >
                1. Expo Cloud Install
              </button>
              <button
                onClick={() => setActiveTab('apk')}
                className={`px-3 py-1.5 font-mono text-xs font-bold uppercase transition-all ${
                  activeTab === 'apk'
                    ? 'bg-emerald-400 text-black border border-black shadow-[2px_2px_0px_#000]'
                    : 'text-slate-400 hover:text-white'
                }`}
              >
                2. Direct APK (102 MB)
              </button>
              <button
                onClick={() => setActiveTab('expogo')}
                className={`px-3 py-1.5 font-mono text-xs font-bold uppercase transition-all ${
                  activeTab === 'expogo'
                    ? 'bg-emerald-400 text-black border border-black shadow-[2px_2px_0px_#000]'
                    : 'text-slate-400 hover:text-white'
                }`}
              >
                3. Expo Go (Dev)
              </button>
            </div>
          </div>

          {/* Download Cards Grid */}
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
            {/* Primary Option: Expo Application Download Section */}
            <div className="bg-[#0D2119] border-2 border-emerald-500 p-6 shadow-[6px_6px_0px_#000] flex flex-col justify-between relative overflow-hidden">
              <div className="absolute -top-3 -right-3 bg-emerald-400 text-black font-mono font-black text-[10px] px-3 py-1 border-2 border-black rotate-3 uppercase">
                RECOMMENDED
              </div>

              <div>
                <div className="flex items-center gap-2 mb-3">
                  <div className="w-8 h-8 bg-black border border-emerald-500/50 flex items-center justify-center text-emerald-400 font-mono font-black text-sm">
                    EX
                  </div>
                  <div>
                    <h3 className="text-lg font-black font-mono text-white uppercase">
                      Expo Application Portal
                    </h3>
                    <span className="text-[10px] text-emerald-300 font-mono uppercase">
                      EAS Cloud Build #2f8ac231
                    </span>
                  </div>
                </div>

                <p className="text-xs text-slate-300 leading-relaxed mb-5">
                  Opens the official Expo Application portal with instant install links, preview
                  credentials, and compatibility checks for Android devices.
                </p>

                {/* QR Code Container */}
                <div className="bg-white p-3 border-2 border-black shadow-[3px_3px_0px_#000] w-fit mx-auto mb-5 text-center">
                  <QRCodeSVG
                    value={EXPO_BUILD_PAGE}
                    size={140}
                    level="M"
                    fgColor="#000000"
                    bgColor="#ffffff"
                  />
                  <div className="text-[9px] font-mono text-black font-bold uppercase tracking-wider mt-1.5">
                    POINT CAMERA TO INSTALL
                  </div>
                </div>
              </div>

              <div className="space-y-2.5">
                <a
                  href={EXPO_BUILD_PAGE}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="w-full py-3 bg-emerald-400 hover:bg-emerald-300 text-black border-2 border-black font-mono text-xs font-black uppercase tracking-wider transition-all shadow-[3px_3px_0px_#000] active:translate-x-0.5 active:translate-y-0.5 active:shadow-none flex items-center justify-center gap-2 text-center"
                >
                  <span>Open Expo App Page</span>
                  <ExternalLink className="w-4 h-4 stroke-[2.5]" />
                </a>

                <button
                  onClick={() => copyToClipboard(EXPO_BUILD_PAGE)}
                  className="w-full py-2 bg-black hover:bg-[#07130D] text-slate-300 hover:text-white border border-slate-700 font-mono text-[11px] font-bold uppercase transition-all flex items-center justify-center gap-1.5"
                >
                  {copiedLink ? (
                    <>
                      <Check className="w-3.5 h-3.5 text-emerald-400" />
                      <span>Copied Expo URL!</span>
                    </>
                  ) : (
                    <>
                      <Copy className="w-3.5 h-3.5" />
                      <span>Copy Expo Download Link</span>
                    </>
                  )}
                </button>
              </div>
            </div>

            {/* Direct Standalone APK Download */}
            <div className="bg-[#0B1A14] border-2 border-black p-6 shadow-[6px_6px_0px_#000] flex flex-col justify-between">
              <div>
                <div className="flex items-center gap-2 mb-3">
                  <div className="w-8 h-8 bg-black border border-slate-700 flex items-center justify-center text-emerald-400 font-mono font-black text-sm">
                    APK
                  </div>
                  <div>
                    <h3 className="text-lg font-black font-mono text-white uppercase">
                      Direct APK File
                    </h3>
                    <span className="text-[10px] text-slate-400 font-mono uppercase">
                      Standalone Android Package (102 MB)
                    </span>
                  </div>
                </div>

                <p className="text-xs text-slate-300 leading-relaxed mb-5">
                  Direct standalone binary download. Install directly via Android package installer
                  without requiring Expo CLI or developer tools.
                </p>

                {/* Specs Box */}
                <div className="bg-[#07130E] border border-slate-800 p-3 mb-5 font-mono text-xs space-y-1.5">
                  <div className="flex justify-between text-slate-400">
                    <span>Artifact:</span>
                    <span className="text-white font-bold">ecopulse.apk</span>
                  </div>
                  <div className="flex justify-between text-slate-400">
                    <span>Size:</span>
                    <span className="text-emerald-400 font-bold">101.54 MB</span>
                  </div>
                  <div className="flex justify-between text-slate-400">
                    <span>Permissions:</span>
                    <span className="text-white">Camera, Fine GPS</span>
                  </div>
                  <div className="flex justify-between text-slate-400">
                    <span>API Gateway:</span>
                    <span className="text-emerald-400 truncate max-w-[150px]">
                      ngrok HTTPS Gateway
                    </span>
                  </div>
                </div>
              </div>

              <div className="space-y-2.5">
                <a
                  href={DIRECT_APK_URL}
                  download="ecopulse.apk"
                  className="w-full py-3 bg-white hover:bg-slate-200 text-black border-2 border-black font-mono text-xs font-black uppercase tracking-wider transition-all shadow-[3px_3px_0px_#000] active:translate-x-0.5 active:translate-y-0.5 active:shadow-none flex items-center justify-center gap-2 text-center"
                >
                  <Download className="w-4 h-4 stroke-[2.5]" />
                  <span>Download Standalone APK</span>
                </a>

                <a
                  href={S3_APK_URL}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="w-full py-2 bg-[#05110B] hover:bg-black text-emerald-400 hover:text-emerald-300 border border-emerald-500/40 font-mono text-[11px] font-bold uppercase transition-all flex items-center justify-center gap-1.5"
                >
                  <Globe className="w-3.5 h-3.5" />
                  <span>AWS S3 Sydney Mirror (7-Day Link)</span>
                </a>
              </div>
            </div>

            {/* Expo Go Runtime (Dev) */}
            <div className="bg-[#0B1A14] border-2 border-black p-6 shadow-[6px_6px_0px_#000] flex flex-col justify-between">
              <div>
                <div className="flex items-center gap-2 mb-3">
                  <div className="w-8 h-8 bg-black border border-slate-700 flex items-center justify-center text-emerald-400 font-mono font-black text-sm">
                    DEV
                  </div>
                  <div>
                    <h3 className="text-lg font-black font-mono text-white uppercase">
                      Expo Go Runtime
                    </h3>
                    <span className="text-[10px] text-slate-400 font-mono uppercase">
                      Live Metro Development Server
                    </span>
                  </div>
                </div>

                <p className="text-xs text-slate-300 leading-relaxed mb-5">
                  Launch instantly through the standard Expo Go client on Android or iOS without
                  installing an APK file.
                </p>

                {/* Metro Address Box */}
                <div className="bg-[#07130E] border border-slate-800 p-3 mb-5 font-mono text-xs">
                  <div className="text-[10px] text-slate-500 uppercase tracking-widest mb-1">
                    METRO ENDPOINT URL
                  </div>
                  <div className="bg-black p-2 border border-slate-800 text-emerald-400 break-all select-all font-mono text-xs">
                    {EXPO_GO_URL}
                  </div>
                  <div className="text-[10px] text-slate-400 mt-2 flex items-center gap-1">
                    <CheckCircle2 className="w-3 h-3 text-emerald-400" />
                    <span>Active on Port 8081</span>
                  </div>
                </div>
              </div>

              <div className="space-y-2.5">
                <a
                  href={EXPO_GO_URL}
                  className="w-full py-3 bg-[#112B1E] hover:bg-[#183A2A] text-emerald-300 hover:text-white border-2 border-black font-mono text-xs font-bold uppercase tracking-wider transition-all shadow-[3px_3px_0px_#000] active:translate-x-0.5 active:translate-y-0.5 active:shadow-none flex items-center justify-center gap-2 text-center"
                >
                  <ExternalLink className="w-4 h-4" />
                  <span>Open in Expo Go</span>
                </a>

                <button
                  onClick={() => copyToClipboard(EXPO_GO_URL)}
                  className="w-full py-2 bg-black hover:bg-[#07130D] text-slate-300 hover:text-white border border-slate-700 font-mono text-[11px] font-bold uppercase transition-all flex items-center justify-center gap-1.5"
                >
                  <Copy className="w-3.5 h-3.5" />
                  <span>Copy Metro URL</span>
                </button>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* Brutalist Platform Feature Grid */}
      <section className="py-20 px-4 sm:px-6 lg:px-8 max-w-7xl mx-auto">
        <div className="mb-12">
          <div className="inline-block px-3 py-1 bg-black border border-emerald-500/50 text-emerald-400 text-xs font-mono font-bold uppercase mb-2">
            // ARCHITECTURE MATRIX
          </div>
          <h2 className="text-3xl sm:text-5xl font-black uppercase text-white tracking-tight">
            ENGINEERED FOR SCALE & CIVIC IMPACT
          </h2>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          {/* Card 1 */}
          <div className="bg-[#0B1A14] border-2 border-black p-6 shadow-[6px_6px_0px_#000] hover:border-emerald-500/50 transition-colors">
            <div className="flex items-center justify-between mb-4">
              <div className="w-10 h-10 bg-emerald-400 border-2 border-black shadow-[2px_2px_0px_#000] flex items-center justify-center text-black font-black">
                <Cpu className="w-5 h-5 stroke-[2.5]" />
              </div>
              <span className="font-mono text-xs text-slate-400 uppercase">[01 // INTELLIGENCE]</span>
            </div>
            <h3 className="text-xl font-black font-mono uppercase text-white mb-2">
              HYBRID VISION AGENTS
            </h3>
            <p className="text-sm text-slate-300 leading-relaxed mb-4">
              Real-time image classification via Google Gemini 3.5 Flash-Lite and AWS Bedrock.
              Automatically analyzes illegal garbage dumping, burning hazards, and water stagnation
              in 1.13 seconds.
            </p>
            <div className="flex flex-wrap gap-2 text-[10px] font-mono text-emerald-300">
              <span className="px-2 py-0.5 bg-black border border-emerald-500/30">
                0-COST INFERENCE
              </span>
              <span className="px-2 py-0.5 bg-black border border-emerald-500/30">
                STRICT RISK SCORING
              </span>
            </div>
          </div>

          {/* Card 2 */}
          <div className="bg-[#0B1A14] border-2 border-black p-6 shadow-[6px_6px_0px_#000] hover:border-emerald-500/50 transition-colors">
            <div className="flex items-center justify-between mb-4">
              <div className="w-10 h-10 bg-emerald-400 border-2 border-black shadow-[2px_2px_0px_#000] flex items-center justify-center text-black font-black">
                <MapPin className="w-5 h-5 stroke-[2.5]" />
              </div>
              <span className="font-mono text-xs text-slate-400 uppercase">[02 // SPATIAL]</span>
            </div>
            <h3 className="text-xl font-black font-mono uppercase text-white mb-2">
              PUNE WARD RADAR & MAPS
            </h3>
            <p className="text-sm text-slate-300 leading-relaxed mb-4">
              High-resolution density mapping for Pune municipal zones (Kothrud, Viman Nagar,
              Hadapsar). Clusters repetitive violations and dispatches prioritized sanitation crews.
            </p>
            <div className="flex flex-wrap gap-2 text-[10px] font-mono text-emerald-300">
              <span className="px-2 py-0.5 bg-black border border-emerald-500/30">LEAFLET MAP</span>
              <span className="px-2 py-0.5 bg-black border border-emerald-500/30">
                POSTGIS / PGVECTOR
              </span>
            </div>
          </div>

          {/* Card 3 */}
          <div className="bg-[#0B1A14] border-2 border-black p-6 shadow-[6px_6px_0px_#000] hover:border-emerald-500/50 transition-colors">
            <div className="flex items-center justify-between mb-4">
              <div className="w-10 h-10 bg-emerald-400 border-2 border-black shadow-[2px_2px_0px_#000] flex items-center justify-center text-black font-black">
                <Award className="w-5 h-5 stroke-[2.5]" />
              </div>
              <span className="font-mono text-xs text-slate-400 uppercase">[03 // CITIZEN]</span>
            </div>
            <h3 className="text-xl font-black font-mono uppercase text-white mb-2">
              CIVIC REPUTATION & GREEN REWARDS
            </h3>
            <p className="text-sm text-slate-300 leading-relaxed mb-4">
              Every verified cleanup or violation report awards green coins and proof-of-action
              badges. Residents can redeem reward vouchers directly in the mobile client.
            </p>
            <div className="flex flex-wrap gap-2 text-[10px] font-mono text-emerald-300">
              <span className="px-2 py-0.5 bg-black border border-emerald-500/30">
                GREEN COIN BALANCE
              </span>
              <span className="px-2 py-0.5 bg-black border border-emerald-500/30">
                MERCHANT VOUCHERS
              </span>
            </div>
          </div>

          {/* Card 4 */}
          <div className="bg-[#0B1A14] border-2 border-black p-6 shadow-[6px_6px_0px_#000] hover:border-emerald-500/50 transition-colors">
            <div className="flex items-center justify-between mb-4">
              <div className="w-10 h-10 bg-emerald-400 border-2 border-black shadow-[2px_2px_0px_#000] flex items-center justify-center text-black font-black">
                <Layers className="w-5 h-5 stroke-[2.5]" />
              </div>
              <span className="font-mono text-xs text-slate-400 uppercase">[04 // BACKBONE]</span>
            </div>
            <h3 className="text-xl font-black font-mono uppercase text-white mb-2">
              AWS EVENT-DRIVEN CLOUD
            </h3>
            <p className="text-sm text-slate-300 leading-relaxed mb-4">
              Fully decoupled architecture using AWS S3 evidence storage, Amazon EventBridge
              custom event bus, SQS processing queues with DLQ, and Neon Serverless PostgreSQL.
            </p>
            <div className="flex flex-wrap gap-2 text-[10px] font-mono text-emerald-300">
              <span className="px-2 py-0.5 bg-black border border-emerald-500/30">
                EVENTBRIDGE BUS
              </span>
              <span className="px-2 py-0.5 bg-black border border-emerald-500/30">SQS DLQ</span>
              <span className="px-2 py-0.5 bg-black border border-emerald-500/30">
                S3 EVIDENCE BUCKET
              </span>
            </div>
          </div>
        </div>
      </section>

      {/* Bottom Command Center Launch Banner */}
      <section className="bg-emerald-400 text-black border-y-4 border-black py-12 px-4 sm:px-6 lg:px-8">
        <div className="max-w-7xl mx-auto flex flex-col md:flex-row items-center justify-between gap-6">
          <div>
            <span className="text-xs font-mono font-black uppercase tracking-widest bg-black text-emerald-400 px-2.5 py-1">
              READY FOR OPERATIONAL DISPATCH
            </span>
            <h3 className="text-2xl sm:text-4xl font-black uppercase tracking-tight mt-2 text-black">
              ACCESS THE PUNE MUNICIPAL DASHBOARD
            </h3>
            <p className="text-sm font-medium text-black/80 max-w-xl mt-1">
              Inspect citizen violation feeds, review AI automated risk assessments, and dispatch
              field intervention teams in real-time.
            </p>
          </div>

          <button
            onClick={() => navigate('/operations')}
            className="px-8 py-4 bg-black hover:bg-slate-900 text-emerald-400 border-2 border-black font-mono text-sm font-black uppercase tracking-wider transition-all shadow-[5px_5px_0px_#fff] hover:shadow-[6px_6px_0px_#fff] active:translate-x-0.5 active:translate-y-0.5 active:shadow-none flex items-center gap-3 shrink-0"
          >
            <span>Open Operations Dashboard</span>
            <ArrowRight className="w-5 h-5 stroke-[2.5]" />
          </button>
        </div>
      </section>

      {/* Brutalist Footer */}
      <footer className="bg-[#050B08] border-t-2 border-black py-10 px-4 sm:px-6 lg:px-8 text-xs font-mono text-slate-400">
        <div className="max-w-7xl mx-auto flex flex-col sm:flex-row items-center justify-between gap-4">
          <div className="flex items-center gap-2">
            <Leaf className="w-4 h-4 text-emerald-400" />
            <span className="font-bold text-white">ECOPULSE SYSTEM</span>
            <span>// PUNE MUNICIPAL CORPORATION</span>
          </div>

          <div className="flex items-center gap-6">
            <button
              onClick={() => window.scrollTo({ top: 0, behavior: 'smooth' })}
              className="text-slate-400 hover:text-emerald-400 transition-colors uppercase font-bold"
            >
              [ ↑ BACK TO TOP ]
            </button>
            <button
              onClick={() => navigate('/operations')}
              className="text-emerald-400 hover:underline uppercase font-bold"
            >
              [ OPEN DASHBOARD → ]
            </button>
          </div>
        </div>
      </footer>
    </div>
  );
};
