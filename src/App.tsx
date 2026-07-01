import React, { useState, useEffect } from "react";
import {
  Facebook,
  Search,
  Copy,
  Check,
  Info,
  HelpCircle,
  Link,
  ExternalLink,
  Code,
  Terminal,
  Cpu,
  BookOpen,
  Compass,
  User,
  Users,
  Flag,
  Calendar,
  Sparkles,
  Smartphone,
  Monitor,
  ArrowRight,
  AlertCircle,
  Layers,
  ChevronDown,
  Globe,
  Share2,
  Lock,
  RefreshCw
} from "lucide-react";

// Interfaces
interface VerifiedProfile {
  name: string;
  category: "founder" | "celebrity" | "brand" | "organization";
  id: string;
  username: string;
  description: string;
  avatarPlaceholder: string;
}

interface ExtractedData {
  originalUrl: string;
  id: string;
  type: string;
  typeName: string;
  isVanity: boolean;
  vanityUsername?: string;
  method: "regex" | "scraped_api" | "manual";
  deepLinks: {
    web: string;
    mobile: string;
    graph: string;
  };
}

export default function App() {
  // Application States
  const [urlInput, setUrlInput] = useState("");
  const [extractedData, setExtractedData] = useState<ExtractedData | null>(null);
  const [isAnalyzing, setIsAnalyzing] = useState(false);
  const [errorMessage, setErrorMessage] = useState("");
  const [copiedText, setCopiedText] = useState<string | null>(null);
  
  // Tab states
  const [activeTab, setActiveTab] = useState<"parser" | "guide" | "directory" | "deep_linker">("parser");
  const [guideTab, setGuideTab] = useState<"desktop" | "mobile">("desktop");
  
  // Custom Raw ID Formatter States
  const [rawId, setRawId] = useState("");
  const [rawIdType, setRawIdType] = useState<"profile" | "page" | "group" | "event">("profile");
  const [formattedLinks, setFormattedLinks] = useState<{ web: string; mobile: string; graph: string } | null>(null);

  // Directory States
  const [directorySearch, setDirectorySearch] = useState("");
  const [selectedCategory, setSelectedCategory] = useState<string>("all");

  // Accordion state for FAQs
  const [openFaq, setOpenFaq] = useState<number | null>(null);

  // Verified directory data
  const verifiedDirectory: VerifiedProfile[] = [
    {
      name: "Mark Zuckerberg",
      category: "founder",
      id: "4",
      username: "zuck",
      description: "Co-founder & CEO of Meta (formerly Facebook). This is the 4th account ever created.",
      avatarPlaceholder: "MZ"
    },
    {
      name: "Facebook Official Page",
      category: "brand",
      id: "20531316728",
      username: "facebook",
      description: "The official product page of Facebook itself.",
      avatarPlaceholder: "FB"
    },
    {
      name: "Cristiano Ronaldo",
      category: "celebrity",
      id: "81221197163",
      username: "cristiano",
      description: "Portuguese professional footballer. One of the most followed athletes globally.",
      avatarPlaceholder: "CR"
    },
    {
      name: "Shakira",
      category: "celebrity",
      id: "5049312519",
      username: "shakira",
      description: "Colombian singer and songwriter with a massive international following.",
      avatarPlaceholder: "SH"
    },
    {
      name: "National Geographic",
      category: "organization",
      id: "23497828950",
      username: "natgeo",
      description: "Renowned globally for exploration, science, and beautiful photography.",
      avatarPlaceholder: "NG"
    },
    {
      name: "Barack Obama",
      category: "celebrity",
      id: "6815827484",
      username: "barackobama",
      description: "The official public page of the 44th President of the United States.",
      avatarPlaceholder: "BO"
    },
    {
      name: "Coca-Cola",
      category: "brand",
      id: "40796308305",
      username: "cocacola",
      description: "One of the most recognizable consumer beverage brands in history.",
      avatarPlaceholder: "CC"
    },
    {
      name: "NASA",
      category: "organization",
      id: "54974305872",
      username: "nasa",
      description: "United States government agency responsible for the civilian space program.",
      avatarPlaceholder: "NS"
    }
  ];

  // Helper function to handle text copying
  const copyToClipboard = (text: string, id: string) => {
    navigator.clipboard.writeText(text);
    setCopiedText(id);
    setTimeout(() => {
      setCopiedText(null);
    }, 2000);
  };

  // Main Parsing and Resolving Logic (Client-side fast regex + Real backend scraping fallback)
  const handleAnalyze = async (inputVal: string = urlInput) => {
    const cleanedUrl = inputVal.trim();
    if (!cleanedUrl) {
      setErrorMessage("Vui lòng nhập URL Facebook hợp lệ / Please enter a valid Facebook URL.");
      setExtractedData(null);
      return;
    }

    setIsAnalyzing(true);
    setErrorMessage("");
    setExtractedData(null);

    // Try fast Client-Side Regex first for explicit numerical IDs (saves server hits)
    const directNumRegexes = [
      { regex: /[?&]id=(\d+)/i, type: "profile", typeName: "User Profile (From URL parameter)" },
      { regex: /facebook\.com\/p\/[a-zA-Z0-9.-]+-(\d+)/i, type: "profile", typeName: "User Profile (Modern 'p' layout)" },
      { regex: /\/groups\/(\d+)/i, type: "group", typeName: "Facebook Group (Numeric URL)" },
      { regex: /\/events\/(\d+)/i, type: "event", typeName: "Facebook Event" },
      { regex: /\/people\/[a-zA-Z0-9.-]+\/(\d+)/i, type: "profile", typeName: "User Profile (Numeric path)" },
      { regex: /\/pages\/[a-zA-Z0-9.-]+\/(\d+)/i, type: "page", typeName: "Facebook Page (Numeric path)" },
      { regex: /[?&]fbid=(\d+)/i, type: "photo", typeName: "Facebook Photo / Media" },
      { regex: /\/posts\/(\d+)/i, type: "post", typeName: "Facebook Post" }
    ];

    for (const item of directNumRegexes) {
      const match = cleanedUrl.match(item.regex);
      if (match && match[1]) {
        // Fast match succeeded! No backend request needed.
        const id = match[1];
        setExtractedData({
          originalUrl: cleanedUrl,
          id: id,
          type: item.type,
          typeName: item.typeName,
          isVanity: false,
          method: "regex",
          deepLinks: {
            web: `https://facebook.com/${id}`,
            mobile: item.type === "group" ? `fb://group/?id=${id}` : item.type === "page" ? `fb://page/${id}` : `fb://profile/${id}`,
            graph: `https://graph.facebook.com/${id}`
          }
        });
        setIsAnalyzing(false);
        return;
      }
    }

    // If it is a vanity URL, we must call our advanced backend API to fetch the HTML and extract the ID dynamically!
    console.log("[Client] Vanity URL detected. Requesting server-side high-fidelity scrape & AI extraction.");
    
    try {
      const response = await fetch("/api/resolve-id", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ url: cleanedUrl })
      });

      const result = await response.json();

      if (!response.ok || !result.success) {
        throw new Error(result.error || "Could not load ID from the public page source.");
      }

      // Success from Backend Server Scrape/AI Finder!
      const id = result.id;
      const type = (result.type || "profile").toLowerCase();
      
      setExtractedData({
        originalUrl: cleanedUrl,
        id: id,
        type: type,
        typeName: `${result.type} (Tự động lấy ID thành công / Automatically extracted)`,
        isVanity: true,
        method: "scraped_api",
        deepLinks: {
          web: `https://facebook.com/${id}`,
          mobile: type === "group" ? `fb://group/?id=${id}` : type === "page" ? `fb://page/${id}` : `fb://profile/${id}`,
          graph: `https://graph.facebook.com/${id}`
        }
      });
    } catch (err: any) {
      console.error("[Client] Backend error:", err);
      
      // Fallback custom vanity name display with instructions
      let vanityName = "Unknown";
      const vanityRegex = /facebook\.com\/([a-zA-Z0-9._-]+)(?:\/|\?|$)/i;
      const match = cleanedUrl.match(vanityRegex);
      if (match && match[1]) {
        vanityName = match[1];
      }

      setErrorMessage(
        `Không thể tự động quét ID cho "${vanityName}" (Có thể do thiết lập riêng tư hoặc Facebook chặn bot). Bạn hãy xem hướng dẫn thủ công "Manual Source Guide" bên dưới để lấy ID chỉ trong 10 giây!`
      );
      
      // Display visual fallback container
      setExtractedData({
        originalUrl: cleanedUrl,
        id: "CẦN LẤY THỦ CÔNG (Xem hướng dẫn)",
        type: "unknown",
        typeName: "Facebook Vanity URL (Profile/Page)",
        isVanity: true,
        vanityUsername: vanityName,
        method: "manual",
        deepLinks: {
          web: cleanedUrl,
          mobile: `fb://profile/${vanityName}`,
          graph: `https://graph.facebook.com/${vanityName}`
        }
      });
    } finally {
      setIsAnalyzing(false);
    }
  };

  // Raw ID Link Generator
  useEffect(() => {
    if (rawId.trim()) {
      const cleanId = rawId.replace(/\D/g, ""); // Keep only digits
      let mobileDeep = `fb://profile/${cleanId}`;
      if (rawIdType === "group") mobileDeep = `fb://group/?id=${cleanId}`;
      if (rawIdType === "page") mobileDeep = `fb://page/${cleanId}`;
      if (rawIdType === "event") mobileDeep = `fb://event/?id=${cleanId}`;

      setFormattedLinks({
        web: `https://facebook.com/${cleanId}`,
        mobile: mobileDeep,
        graph: `https://graph.facebook.com/${cleanId}`
      });
    } else {
      setFormattedLinks(null);
    }
  }, [rawId, rawIdType]);

  // Handle preset clicks from the verified directory
  const handleDirectorySelect = (profile: VerifiedProfile) => {
    setUrlInput(`https://facebook.com/${profile.username}`);
    setActiveTab("parser");
    handleAnalyze(`https://facebook.com/${profile.username}`);
  };

  // Filtered Verified profiles
  const filteredProfiles = verifiedDirectory.filter(profile => {
    const matchesSearch = profile.name.toLowerCase().includes(directorySearch.toLowerCase()) || 
                          profile.username.toLowerCase().includes(directorySearch.toLowerCase()) ||
                          profile.id.includes(directorySearch);
    const matchesCategory = selectedCategory === "all" || profile.category === selectedCategory;
    return matchesSearch && matchesCategory;
  });

  return (
    <div className="min-h-screen bg-[#07080a] text-zinc-100 flex flex-col justify-between selection:bg-zinc-800 selection:text-white antialiased">
      {/* Background Glow */}
      <div className="absolute top-0 left-1/2 -translate-x-1/2 w-full max-w-7xl h-[450px] pointer-events-none overflow-hidden opacity-30 z-0">
        <div className="absolute top-[-250px] left-[15%] w-[600px] h-[600px] bg-gradient-to-br from-zinc-700 to-transparent rounded-full blur-[160px]" />
        <div className="absolute top-[-200px] right-[15%] w-[500px] h-[500px] bg-gradient-to-bl from-zinc-800 to-transparent rounded-full blur-[140px]" />
      </div>

      {/* Main Container */}
      <div className="relative w-full max-w-6xl mx-auto px-4 py-8 z-10 flex-grow">
        {/* Header Section */}
        <header className="mb-10 text-center md:text-left flex flex-col md:flex-row md:items-center md:justify-between border-b border-zinc-900 pb-8 gap-6" id="app-header">
          <div className="flex items-center gap-4 justify-center md:justify-start">
            <div className="w-14 h-14 rounded-2xl bg-zinc-900 border border-zinc-800 flex items-center justify-center shadow-lg shadow-black/40 group hover:border-zinc-700 transition-colors" id="logo-container">
              <Facebook className="w-7 h-7 text-white group-hover:scale-105 transition-transform" />
            </div>
            <div>
              <div className="flex items-center gap-2.5 justify-center md:justify-start">
                <h1 className="text-2xl font-bold tracking-tight text-white">Facebook ID Finder</h1>
                <span className="px-2 py-0.5 text-[10px] uppercase tracking-widest font-mono-custom bg-zinc-900 border border-zinc-800 rounded text-zinc-400">v2.5 Live</span>
              </div>
              <p className="text-sm text-zinc-400 mt-1">Tự động lấy ID từ URL cá nhân, nhóm và trang Fanpage chính xác.</p>
            </div>
          </div>
          
          <div className="flex items-center gap-3 justify-center">
            <div className="flex items-center gap-1.5 px-3 py-1.5 rounded-full bg-zinc-900/60 border border-zinc-800/80 text-xs font-mono-custom text-zinc-400">
              <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse"></span>
              Auto-Lookup: Active
            </div>
            <div className="flex items-center gap-1.5 px-3 py-1.5 rounded-full bg-zinc-900/60 border border-zinc-800/80 text-xs font-mono-custom text-zinc-400">
              <Sparkles className="w-3.5 h-3.5 text-zinc-500" />
              AI Parser Backed
            </div>
          </div>
        </header>

        {/* Navigation Tabs */}
        <nav className="flex flex-wrap gap-2 mb-8 bg-zinc-950/60 p-1.5 border border-zinc-900 rounded-xl max-w-2xl" id="nav-tabs">
          <button
            id="tab-parser"
            onClick={() => { setActiveTab("parser"); setErrorMessage(""); }}
            className={`flex items-center gap-2 px-4 py-2.5 text-xs font-medium tracking-wide rounded-lg transition-all duration-150 cursor-pointer ${
              activeTab === "parser"
                ? "bg-zinc-800 text-white shadow-md border-t border-zinc-700"
                : "text-zinc-400 hover:text-white hover:bg-zinc-900"
            }`}
          >
            <Link className="w-3.5 h-3.5" />
            URL Extractor (Tự Động)
          </button>
          
          <button
            id="tab-guide"
            onClick={() => setActiveTab("guide")}
            className={`flex items-center gap-2 px-4 py-2.5 text-xs font-medium tracking-wide rounded-lg transition-all duration-150 cursor-pointer ${
              activeTab === "guide"
                ? "bg-zinc-800 text-white shadow-md border-t border-zinc-700"
                : "text-zinc-400 hover:text-white hover:bg-zinc-900"
            }`}
          >
            <Code className="w-3.5 h-3.5" />
            Hướng Dẫn Thủ Công (Manual)
          </button>

          <button
            id="tab-directory"
            onClick={() => setActiveTab("directory")}
            className={`flex items-center gap-2 px-4 py-2.5 text-xs font-medium tracking-wide rounded-lg transition-all duration-150 cursor-pointer ${
              activeTab === "directory"
                ? "bg-zinc-800 text-white shadow-md border-t border-zinc-700"
                : "text-zinc-400 hover:text-white hover:bg-zinc-900"
            }`}
          >
            <Compass className="w-3.5 h-3.5" />
            Tài Khoản Mẫu (Directory)
          </button>

          <button
            id="tab-deep-linker"
            onClick={() => setActiveTab("deep_linker")}
            className={`flex items-center gap-2 px-4 py-2.5 text-xs font-medium tracking-wide rounded-lg transition-all duration-150 cursor-pointer ${
              activeTab === "deep_linker"
                ? "bg-zinc-800 text-white shadow-md border-t border-zinc-700"
                : "text-zinc-400 hover:text-white hover:bg-zinc-900"
            }`}
          >
            <Layers className="w-3.5 h-3.5" />
            ID sang Deep-Link
          </button>
        </nav>

        {/* Content Area */}
        <main className="grid grid-cols-1 lg:grid-cols-3 gap-8 items-start">
          
          {/* LEFT/CENTER MAIN PANELS (2 COLS) */}
          <div className="lg:col-span-2 space-y-8">
            
            {/* TAB 1: URL EXTRACTOR */}
            {activeTab === "parser" && (
              <section className="bg-zinc-950 border border-zinc-900 rounded-2xl p-6 shadow-xl relative overflow-hidden" id="parser-panel">
                <div className="absolute top-0 right-0 w-32 h-32 bg-zinc-900/10 rounded-full blur-xl pointer-events-none" />
                
                <h2 className="text-lg font-bold text-white flex items-center gap-2.5 mb-2">
                  <Cpu className="w-5 h-5 text-zinc-400" />
                  Bộ Tự Động Lấy ID Facebook
                </h2>
                <p className="text-xs text-zinc-400 mb-6">
                  Nhập bất kỳ liên kết cá nhân, trang (Page), nhóm (Group) hoặc liên kết dạng vanity (ví dụ: <code className="text-zinc-300 font-mono-custom">https://www.facebook.com/hieeus.mahask/</code>). 
                  Hệ thống của chúng tôi sẽ tự động gửi yêu cầu, tải trang nguồn và giải mã mã số ID thực của tài khoản đó ngay lập tức.
                </p>

                <div className="space-y-4">
                  <div>
                    <label htmlFor="fb-url" className="block text-xs font-medium text-zinc-400 mb-2 font-mono-custom uppercase tracking-wider">
                      Nhập Liên Kết Facebook (Facebook URL)
                    </label>
                    <div className="relative flex items-center">
                      <div className="absolute left-4 text-zinc-500">
                        <Link className="w-4 h-4" />
                      </div>
                      <input
                        id="fb-url"
                        type="url"
                        placeholder="Ví dụ: https://www.facebook.com/hieeus.mahask/"
                        value={urlInput}
                        onChange={(e) => setUrlInput(e.target.value)}
                        onKeyDown={(e) => e.key === "Enter" && handleAnalyze()}
                        className="w-full bg-zinc-900/60 border border-zinc-800 rounded-xl py-3.5 pl-11 pr-24 text-sm text-white placeholder-zinc-500 focus:outline-none focus:border-zinc-700 focus:ring-1 focus:ring-zinc-700 transition-all font-mono-custom"
                      />
                      <div className="absolute right-2 flex items-center gap-1.5">
                        {urlInput && (
                          <button 
                            onClick={() => { setUrlInput(""); setExtractedData(null); }}
                            className="p-1 px-2 text-[10px] text-zinc-500 hover:text-zinc-300 font-mono-custom hover:bg-zinc-800 rounded"
                          >
                            Xóa
                          </button>
                        )}
                        <button
                          onClick={() => handleAnalyze()}
                          disabled={isAnalyzing}
                          className="bg-white hover:bg-zinc-200 text-[#07080a] font-bold text-xs py-2 px-3.5 rounded-lg transition-all duration-150 flex items-center gap-1.5 cursor-pointer shadow disabled:opacity-50"
                        >
                          {isAnalyzing ? "Đang lấy..." : "Lấy ID"}
                          <ArrowRight className="w-3 h-3" />
                        </button>
                      </div>
                    </div>
                  </div>

                  {errorMessage && (
                    <div className="flex gap-2.5 items-start bg-zinc-900/80 border border-zinc-800 rounded-xl p-4 text-xs text-zinc-300" id="error-card">
                      <AlertCircle className="w-4 h-4 mt-0.5 shrink-0 text-amber-400" />
                      <div>
                        <p className="font-semibold text-white">Lưu ý / Warning</p>
                        <p className="mt-1 text-zinc-400 leading-relaxed">{errorMessage}</p>
                      </div>
                    </div>
                  )}

                  {/* Extracting Animation Screen */}
                  {isAnalyzing && (
                    <div className="bg-zinc-900/20 border border-zinc-800/80 rounded-xl p-10 flex flex-col items-center justify-center gap-4 text-center">
                      <div className="relative flex items-center justify-center">
                        <div className="w-10 h-10 border-2 border-zinc-850 border-t-white rounded-full animate-spin" />
                        <Facebook className="w-4 h-4 text-zinc-500 absolute" />
                      </div>
                      <div>
                        <p className="text-xs font-semibold text-white tracking-wide">Đang liên kết máy chủ Facebook...</p>
                        <p className="text-[10px] text-zinc-500 font-mono-custom mt-1">Đang tải mã HTML • Quét thẻ App Link • Phân tích bằng AI</p>
                      </div>
                    </div>
                  )}

                  {/* Extraction Success Panel */}
                  {extractedData && !isAnalyzing && (
                    <div className="bg-zinc-900/40 border border-zinc-800 rounded-xl p-5 space-y-5 animate-fade-in" id="success-results">
                      <div className="flex items-center justify-between border-b border-zinc-800 pb-3">
                        <div className="flex items-center gap-2">
                          <span className="p-1.5 rounded-lg bg-zinc-800 border border-zinc-700 text-zinc-400">
                            {extractedData.type === "group" ? (
                              <Users className="w-4 h-4 text-zinc-300" />
                            ) : extractedData.type === "page" ? (
                              <Flag className="w-4 h-4 text-zinc-300" />
                            ) : extractedData.type === "event" ? (
                              <Calendar className="w-4 h-4 text-zinc-300" />
                            ) : (
                              <User className="w-4 h-4 text-zinc-300" />
                            )}
                          </span>
                          <div>
                            <p className="text-[10px] uppercase tracking-wider font-mono-custom text-zinc-500">Loại Tài Khoản (Type)</p>
                            <h3 className="text-xs font-semibold text-white">{extractedData.typeName}</h3>
                          </div>
                        </div>
                        
                        {extractedData.method === "scraped_api" && (
                          <span className="px-2 py-0.5 rounded bg-zinc-800 border border-zinc-700 text-[10px] text-emerald-400 font-mono-custom flex items-center gap-1">
                            <span className="w-1.5 h-1.5 rounded-full bg-emerald-500"></span>
                            Tự Động 100%
                          </span>
                        )}
                        {extractedData.method === "regex" && (
                          <span className="px-2 py-0.5 rounded bg-zinc-800 border border-zinc-700 text-[10px] text-blue-400 font-mono-custom">
                            Giải Mã URL
                          </span>
                        )}
                        {extractedData.method === "manual" && (
                          <span className="px-2 py-0.5 rounded bg-red-950/40 border border-red-900/50 text-[10px] text-amber-400 font-mono-custom flex items-center gap-1">
                            <Lock className="w-3 h-3" />
                            Cần Xem Lại
                          </span>
                        )}
                      </div>

                      {/* Display Results */}
                      {extractedData.method === "manual" ? (
                        <div className="space-y-4">
                          <div className="p-4 bg-zinc-900/80 border border-zinc-850 rounded-xl space-y-3">
                            <div className="flex items-start gap-3">
                              <Info className="w-4 h-4 mt-0.5 text-zinc-400 shrink-0" />
                              <div className="text-xs text-zinc-300">
                                <p className="font-semibold text-white">Tài khoản này chứa Username: <span className="font-mono-custom text-amber-400">@{extractedData.vanityUsername}</span></p>
                                <p className="mt-1 text-zinc-400 leading-relaxed">
                                  Hệ thống không thể tự động tải trực tiếp ID do chế độ bảo mật hoặc cấu hình chặn của Facebook. Bạn có thể dễ dàng xem nguồn HTML để lấy ID tài khoản này chỉ trong 10 giây.
                                </p>
                              </div>
                            </div>
                            
                            <div className="pt-2 border-t border-zinc-800/60 flex flex-col sm:flex-row gap-2">
                              <button
                                onClick={() => setActiveTab("guide")}
                                className="flex-1 bg-zinc-800 hover:bg-zinc-700 border border-zinc-700 text-xs text-white font-medium py-2 px-3 rounded-lg text-center transition-colors flex items-center justify-center gap-1.5 cursor-pointer"
                              >
                                <Code className="w-3.5 h-3.5" />
                                Xem hướng dẫn tự lấy ID
                              </button>
                              
                              <a
                                href={extractedData.originalUrl}
                                target="_blank"
                                rel="noreferrer"
                                className="flex-1 bg-zinc-900 hover:bg-zinc-850 border border-zinc-800 text-xs text-zinc-300 font-medium py-2 px-3 rounded-lg text-center transition-colors flex items-center justify-center gap-1.5"
                              >
                                <ExternalLink className="w-3.5 h-3.5" />
                                Mở Trang Facebook
                              </a>
                            </div>
                          </div>
                        </div>
                      ) : (
                        <div className="space-y-4">
                          <div>
                            <p className="text-[10px] uppercase tracking-wider font-mono-custom text-zinc-500 mb-2">Mã Số Facebook ID Lấy Được (Numeric ID)</p>
                            <div className="flex items-center justify-between gap-3 bg-zinc-950 border border-zinc-800 rounded-xl p-3.5">
                              <code className="text-lg md:text-xl font-bold font-mono-custom text-white tracking-wide break-all">
                                {extractedData.id}
                              </code>
                              <button
                                onClick={() => copyToClipboard(extractedData.id, "success-id")}
                                className="shrink-0 p-2 rounded-lg bg-zinc-900 border border-zinc-800 hover:bg-zinc-800 hover:border-zinc-700 text-zinc-400 hover:text-white transition-all cursor-pointer flex items-center gap-1.5 text-xs font-mono-custom"
                                title="Copy ID"
                              >
                                {copiedText === "success-id" ? (
                                  <>
                                    <Check className="w-3.5 h-3.5 text-emerald-400" />
                                    <span className="text-emerald-400">Đã chép!</span>
                                  </>
                                ) : (
                                  <>
                                    <Copy className="w-3.5 h-3.5" />
                                    <span>Copy ID</span>
                                  </>
                                )}
                              </button>
                            </div>
                          </div>

                          {/* Deep Link Packages */}
                          <div className="space-y-2">
                            <p className="text-[10px] uppercase tracking-wider font-mono-custom text-zinc-500">Liên kết ứng dụng sinh ra từ ID</p>
                            <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                              {/* Web link */}
                              <div className="p-3 bg-zinc-900/40 border border-zinc-800 rounded-lg flex flex-col justify-between gap-2">
                                <div>
                                  <span className="text-[9px] uppercase tracking-wider font-mono-custom text-zinc-400 block font-semibold">Web URL</span>
                                  <code className="text-[10px] font-mono-custom text-zinc-500 truncate block mt-0.5">{extractedData.deepLinks.web}</code>
                                </div>
                                <div className="flex gap-2 mt-1">
                                  <button
                                    onClick={() => copyToClipboard(extractedData.deepLinks.web, "dl-web")}
                                    className="flex-1 py-1 px-2 bg-zinc-900 hover:bg-zinc-800 text-[10px] rounded border border-zinc-800 text-zinc-400 hover:text-white font-mono-custom transition-colors cursor-pointer"
                                  >
                                    {copiedText === "dl-web" ? "Đã chép" : "Sao chép Link"}
                                  </button>
                                  <a
                                    href={extractedData.deepLinks.web}
                                    target="_blank"
                                    rel="noreferrer"
                                    className="p-1 px-2 bg-zinc-900 hover:bg-zinc-800 text-[10px] rounded border border-zinc-800 text-zinc-400 hover:text-white transition-colors flex items-center justify-center"
                                  >
                                    <ExternalLink className="w-3 h-3" />
                                  </a>
                                </div>
                              </div>

                              {/* Mobile app Deep Link */}
                              <div className="p-3 bg-zinc-900/40 border border-zinc-800 rounded-lg flex flex-col justify-between gap-2">
                                <div>
                                  <span className="text-[9px] uppercase tracking-wider font-mono-custom text-zinc-400 block font-semibold">Mobile Deep Link (fb://)</span>
                                  <code className="text-[10px] font-mono-custom text-zinc-500 truncate block mt-0.5">{extractedData.deepLinks.mobile}</code>
                                </div>
                                <div className="flex gap-2 mt-1">
                                  <button
                                    onClick={() => copyToClipboard(extractedData.deepLinks.mobile, "dl-mob")}
                                    className="flex-1 py-1 px-2 bg-zinc-900 hover:bg-zinc-800 text-[10px] rounded border border-zinc-800 text-zinc-400 hover:text-white font-mono-custom transition-colors cursor-pointer"
                                  >
                                    {copiedText === "dl-mob" ? "Đã chép" : "Sao chép Scheme"}
                                  </button>
                                  <a
                                    href={extractedData.deepLinks.mobile}
                                    className="p-1 px-2 bg-zinc-900 hover:bg-zinc-800 text-[10px] rounded border border-zinc-800 text-zinc-400 hover:text-white transition-colors flex items-center justify-center"
                                    title="Mở ứng dụng FB"
                                  >
                                    <Smartphone className="w-3 h-3" />
                                  </a>
                                </div>
                              </div>
                            </div>
                          </div>
                        </div>
                      )}
                    </div>
                  )}
                </div>

                {/* Quick Examples Helper */}
                <div className="mt-8 pt-5 border-t border-zinc-900">
                  <p className="text-xs font-semibold text-zinc-400 mb-2.5">Thử nghiệm nhanh bằng các mẫu URL thực tế:</p>
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-2 text-[11px]">
                    <button
                      onClick={() => {
                        setUrlInput("https://www.facebook.com/hieeus.mahask/");
                        handleAnalyze("https://www.facebook.com/hieeus.mahask/");
                      }}
                      className="text-left p-2 rounded bg-zinc-900/40 border border-zinc-800/60 text-zinc-400 hover:bg-zinc-900 hover:border-zinc-700 hover:text-white transition-colors cursor-pointer truncate font-mono-custom flex items-center gap-1"
                    >
                      <Sparkles className="w-3 h-3 text-amber-500 shrink-0" />
                      Yêu cầu của bạn: /hieeus.mahask/
                    </button>
                    <button
                      onClick={() => {
                        setUrlInput("https://www.facebook.com/zuck");
                        handleAnalyze("https://www.facebook.com/zuck");
                      }}
                      className="text-left p-2 rounded bg-zinc-900/40 border border-zinc-800/60 text-zinc-400 hover:bg-zinc-900 hover:border-zinc-700 hover:text-white transition-colors cursor-pointer truncate font-mono-custom"
                    >
                      Trang Cá Nhân (Vanity): /zuck
                    </button>
                    <button
                      onClick={() => {
                        setUrlInput("https://www.facebook.com/facebook");
                        handleAnalyze("https://www.facebook.com/facebook");
                      }}
                      className="text-left p-2 rounded bg-zinc-900/40 border border-zinc-800/60 text-zinc-400 hover:bg-zinc-900 hover:border-zinc-700 hover:text-white transition-colors cursor-pointer truncate font-mono-custom"
                    >
                      Trang Fanpage (Brand): /facebook
                    </button>
                    <button
                      onClick={() => {
                        setUrlInput("https://www.facebook.com/groups/10987654321/");
                        handleAnalyze("https://www.facebook.com/groups/10987654321/");
                      }}
                      className="text-left p-2 rounded bg-zinc-900/40 border border-zinc-800/60 text-zinc-400 hover:bg-zinc-900 hover:border-zinc-700 hover:text-white transition-colors cursor-pointer truncate font-mono-custom"
                    >
                      Nhóm (Numeric Group): /groups/10987654321/
                    </button>
                  </div>
                </div>
              </section>
            )}

            {/* TAB 2: MANUAL SOURCE GUIDE */}
            {activeTab === "guide" && (
              <section className="bg-zinc-950 border border-zinc-900 rounded-2xl p-6 shadow-xl space-y-6" id="guide-panel">
                <div>
                  <h2 className="text-lg font-bold text-white flex items-center gap-2.5">
                    <Code className="w-5 h-5 text-zinc-400" />
                    Hướng Dẫn Lấy ID Từ Mã Nguồn (View Source)
                  </h2>
                  <p className="text-xs text-zinc-400 mt-1">
                    Nếu gặp một trang bảo mật đặc biệt, đây là cách thủ công **chính xác 100%** không bao giờ thất bại để bạn lấy ID tài khoản Facebook trong vòng 10 giây.
                  </p>
                </div>

                {/* Sub-tabs */}
                <div className="flex border-b border-zinc-900 pb-px">
                  <button
                    onClick={() => setGuideTab("desktop")}
                    className={`flex items-center gap-1.5 px-4 py-2 border-b-2 text-xs font-semibold cursor-pointer transition-colors ${
                      guideTab === "desktop"
                        ? "border-white text-white"
                        : "border-transparent text-zinc-500 hover:text-zinc-300"
                    }`}
                  >
                    <Monitor className="w-3.5 h-3.5" />
                    Máy Tính (Desktop)
                  </button>
                  <button
                    onClick={() => setGuideTab("mobile")}
                    className={`flex items-center gap-1.5 px-4 py-2 border-b-2 text-xs font-semibold cursor-pointer transition-colors ${
                      guideTab === "mobile"
                        ? "border-white text-white"
                        : "border-transparent text-zinc-500 hover:text-zinc-300"
                    }`}
                  >
                    <Smartphone className="w-3.5 h-3.5" />
                    Điện Thoại (Mobile)
                  </button>
                </div>

                {/* Desktop Instructions */}
                {guideTab === "desktop" && (
                  <div className="space-y-6">
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                      <div className="space-y-4">
                        <div className="flex gap-3">
                          <span className="w-6 h-6 rounded-full bg-zinc-900 border border-zinc-800 text-xs font-mono-custom flex items-center justify-center text-white shrink-0 mt-0.5">1</span>
                          <div>
                            <h4 className="text-xs font-bold text-white uppercase tracking-wider font-mono-custom">Vào trang Facebook</h4>
                            <p className="text-xs text-zinc-400 mt-0.5">Mở trình duyệt trên máy tính và đi tới trang cá nhân hoặc nhóm bạn muốn lấy ID.</p>
                          </div>
                        </div>

                        <div className="flex gap-3">
                          <span className="w-6 h-6 rounded-full bg-zinc-900 border border-zinc-800 text-xs font-mono-custom flex items-center justify-center text-white shrink-0 mt-0.5">2</span>
                          <div>
                            <h4 className="text-xs font-bold text-white uppercase tracking-wider font-mono-custom">Xem Nguồn Trang</h4>
                            <p className="text-xs text-zinc-400 mt-0.5">
                              Nhấp chuột phải vào khoảng trống bất kỳ trên trang và chọn <strong className="text-zinc-300">"Xem nguồn trang"</strong> (View Page Source), hoặc nhấn phím <code className="bg-zinc-900 px-1 py-0.5 text-[10px] rounded text-white font-mono-custom border border-zinc-800">Ctrl + U</code> (Windows) hoặc <code className="bg-zinc-900 px-1 py-0.5 text-[10px] rounded text-white font-mono-custom border border-zinc-800">Cmd + Option + U</code> (Mac).
                            </p>
                          </div>
                        </div>

                        <div className="flex gap-3">
                          <span className="w-6 h-6 rounded-full bg-zinc-900 border border-zinc-800 text-xs font-mono-custom flex items-center justify-center text-white shrink-0 mt-0.5">3</span>
                          <div>
                            <h4 className="text-xs font-bold text-white uppercase tracking-wider font-mono-custom">Tìm Từ Khóa (ID)</h4>
                            <p className="text-xs text-zinc-400 mt-0.5">
                              Nhấn tổ hợp phím <code className="bg-zinc-900 px-1 py-0.5 text-[10px] rounded text-white font-mono-custom border border-zinc-800">Ctrl + F</code> (hoặc <code className="bg-zinc-900 px-1 py-0.5 text-[10px] rounded text-white font-mono-custom border border-zinc-800">Cmd + F</code>), sau đó sao chép một trong các từ khóa bên cạnh để tìm dòng chứa dãy số ID thực.
                            </p>
                          </div>
                        </div>
                      </div>

                      {/* Keywords list with click-to-copy */}
                      <div className="bg-zinc-900/40 border border-zinc-800 rounded-xl p-4 space-y-3">
                        <span className="text-[10px] uppercase tracking-wider font-mono-custom text-zinc-500 block mb-1 font-semibold">Từ khóa tìm kiếm (Copy & Search)</span>
                        
                        {[
                          { marker: '"userID"', type: "Trang cá nhân của tài khoản chính" },
                          { marker: '"entity_id"', type: "Trang Fanpage / Nhóm / Bài viết" },
                          { marker: '"pageID"', type: "Dành riêng cho Fanpage doanh nghiệp" },
                          { marker: '"profile_owner"', type: "Chủ sở hữu của hồ sơ công khai" }
                        ].map((item, index) => (
                          <div key={index} className="flex items-center justify-between p-2 bg-zinc-950 border border-zinc-900 rounded-lg hover:border-zinc-800 transition-colors">
                            <div>
                              <code className="text-xs text-white font-mono-custom font-bold">{item.marker}</code>
                              <span className="text-[9px] text-zinc-500 block mt-0.5">{item.type}</span>
                            </div>
                            <button
                              onClick={() => copyToClipboard(item.marker.replace(/"/g, ''), `marker-${index}`)}
                              className="p-1 px-2.5 rounded bg-zinc-900 hover:bg-zinc-800 border border-zinc-800 hover:border-zinc-700 text-[10px] font-mono-custom text-zinc-400 hover:text-white transition-all cursor-pointer flex items-center gap-1"
                            >
                              {copiedText === `marker-${index}` ? "Đã chép" : "Chép"}
                            </button>
                          </div>
                        ))}
                      </div>
                    </div>

                    {/* Code simulation representation */}
                    <div className="space-y-2">
                      <span className="text-[10px] uppercase tracking-wider font-mono-custom text-zinc-500 block font-semibold">Minh họa dòng mã chứa ID thực tế:</span>
                      <div className="bg-[#0b0c0e] border border-zinc-900 rounded-xl p-4 font-mono-custom text-xs text-zinc-400 overflow-x-auto relative">
                        <div className="absolute top-2 right-2 flex items-center gap-1.5 bg-zinc-900 px-2 py-1 rounded text-[10px] text-zinc-500 border border-zinc-800">
                          <Terminal className="w-3.5 h-3.5" />
                          <span>view-source:facebook.com/...</span>
                        </div>
                        <p className="text-zinc-600 line-clamp-1">// ... mã hóa JS nén ...</p>
                        <p className="mt-1">{"{"}&quot;user&quot;: &quot;Hieeus Mahask&quot;, <span className="text-emerald-400 font-bold">&quot;userID&quot;: &quot;100028292819282&quot;</span>, &quot;is_verified&quot;: false{"}"}</p>
                        <p className="mt-1">{"{"}&quot;page&quot;: &quot;Fanpage Name&quot;, <span className="text-emerald-400 font-bold">&quot;entity_id&quot;: &quot;509312519&quot;</span>, &quot;status&quot;: &quot;active&quot;{"}"}</p>
                        <p className="text-zinc-600 line-clamp-1 mt-1">// ... phần mã tiếp theo ...</p>
                      </div>
                    </div>
                  </div>
                )}

                {/* Mobile Instructions */}
                {guideTab === "mobile" && (
                  <div className="space-y-4">
                    <div className="p-4 bg-zinc-900/30 border border-zinc-800 rounded-xl space-y-4">
                      <div className="flex gap-3">
                        <div className="w-6 h-6 rounded-full bg-zinc-900 border border-zinc-850 text-xs font-mono-custom flex items-center justify-center text-zinc-300 shrink-0 mt-0.5">1</div>
                        <div>
                          <h4 className="text-xs font-bold text-white uppercase tracking-wider font-mono-custom">Sao Chép Liên Kết</h4>
                          <p className="text-xs text-zinc-400 mt-1">
                            Trong ứng dụng Facebook điện thoại, nhấn vào dấu ba chấm (<strong className="text-white">...</strong>) trên trang cá nhân cần lấy, chọn <strong className="text-white">"Sao chép liên kết"</strong> (Copy link).
                          </p>
                        </div>
                      </div>

                      <div className="flex gap-3">
                        <div className="w-6 h-6 rounded-full bg-zinc-900 border border-zinc-850 text-xs font-mono-custom flex items-center justify-center text-zinc-300 shrink-0 mt-0.5">2</div>
                        <div>
                          <h4 className="text-xs font-bold text-white uppercase tracking-wider font-mono-custom">Mẹo Xem Nguồn Trên Điện Thoại</h4>
                          <p className="text-xs text-zinc-400 mt-1">
                            Mở trình duyệt web của bạn (ví dụ Chrome trên điện thoại), dán liên kết vào ô địa chỉ. Trước khi nhấn chạy, hãy thêm từ khóa <code className="bg-zinc-950 px-1 py-0.5 rounded text-white font-mono-custom border border-zinc-850">view-source:</code> vào ngay phía trước liên kết đó.
                          </p>
                          <div className="mt-2 bg-zinc-950 border border-zinc-850 p-2 rounded-lg flex items-center justify-between text-[11px] font-mono-custom text-zinc-400">
                            <span className="truncate">view-source:https://m.facebook.com/hieeus.mahask/</span>
                            <button
                              onClick={() => copyToClipboard("view-source:https://m.facebook.com/hieeus.mahask/", "viewsource-m")}
                              className="px-2 py-0.5 bg-zinc-900 hover:bg-zinc-800 border border-zinc-800 text-[10px] text-white rounded cursor-pointer shrink-0 ml-2"
                            >
                              {copiedText === "viewsource-m" ? "Đã chép" : "Chép Mẫu"}
                            </button>
                          </div>
                        </div>
                      </div>

                      <div className="flex gap-3">
                        <div className="w-6 h-6 rounded-full bg-zinc-900 border border-zinc-850 text-xs font-mono-custom flex items-center justify-center text-zinc-300 shrink-0 mt-0.5">3</div>
                        <div>
                          <h4 className="text-xs font-bold text-white uppercase tracking-wider font-mono-custom">Tìm ID</h4>
                          <p className="text-xs text-zinc-400 mt-1">
                            Dùng chức năng "Tìm trong trang" (Find in page) của trình duyệt điện thoại để gõ tìm chữ <code className="bg-zinc-950 px-1 text-white rounded font-mono-custom border border-zinc-850">&quot;userID&quot;</code> hoặc <code className="bg-zinc-950 px-1 text-white rounded font-mono-custom border border-zinc-850">&quot;entity_id&quot;</code>. Số ID chính là dãy số đi liền bên cạnh.
                          </p>
                        </div>
                      </div>
                    </div>
                  </div>
                )}
              </section>
            )}

            {/* TAB 3: VERIFIED DIRECTORY */}
            {activeTab === "directory" && (
              <section className="bg-zinc-950 border border-zinc-900 rounded-2xl p-6 shadow-xl space-y-6" id="directory-panel">
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
                  <div>
                    <h2 className="text-lg font-bold text-white flex items-center gap-2.5">
                      <Compass className="w-5 h-5 text-zinc-400" />
                      Danh Sách Tài Khoản Mẫu Trực Tuyến
                    </h2>
                    <p className="text-xs text-zinc-400 mt-1">
                      Các tài khoản nổi tiếng được xác minh ID giúp bạn kiểm nghiệm công cụ nhanh chóng.
                    </p>
                  </div>
                </div>

                {/* Filters */}
                <div className="flex flex-wrap items-center gap-3 bg-zinc-900/30 p-3 rounded-xl border border-zinc-900">
                  <div className="relative flex-grow">
                    <Search className="absolute left-3 top-2.5 w-3.5 h-3.5 text-zinc-500" />
                    <input
                      type="text"
                      placeholder="Tìm kiếm theo tên, username hoặc ID..."
                      value={directorySearch}
                      onChange={(e) => setDirectorySearch(e.target.value)}
                      className="w-full bg-zinc-950 border border-zinc-800 rounded-lg py-1.5 pl-9 pr-4 text-xs text-white placeholder-zinc-500 focus:outline-none focus:border-zinc-700 font-mono-custom"
                    />
                  </div>
                  
                  <div className="flex gap-1">
                    {["all", "founder", "celebrity", "brand", "organization"].map((cat) => (
                      <button
                        key={cat}
                        onClick={() => setSelectedCategory(cat)}
                        className={`px-3 py-1.5 rounded-md text-[10px] font-medium tracking-wide uppercase transition-all cursor-pointer ${
                          selectedCategory === cat
                            ? "bg-zinc-800 text-white"
                            : "text-zinc-500 hover:text-white"
                        }`}
                      >
                        {cat}
                      </button>
                    ))}
                  </div>
                </div>

                {/* Directory list */}
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  {filteredProfiles.map((profile) => (
                    <div 
                      key={profile.id}
                      className="bg-zinc-900/40 border border-zinc-900 rounded-xl p-4 flex flex-col justify-between hover:border-zinc-800 transition-all"
                    >
                      <div>
                        <div className="flex items-start justify-between gap-2">
                          <div className="flex items-center gap-3">
                            <div className="w-10 h-10 rounded-lg bg-zinc-850 border border-zinc-800 text-sm font-bold flex items-center justify-center text-zinc-300">
                              {profile.avatarPlaceholder}
                            </div>
                            <div>
                              <h3 className="text-xs font-bold text-white">{profile.name}</h3>
                              <span className="text-[10px] font-mono-custom text-zinc-500">@{profile.username}</span>
                            </div>
                          </div>
                          
                          <span className="px-2 py-0.5 rounded bg-zinc-800/80 text-[9px] uppercase tracking-wider font-mono-custom text-zinc-400">
                            {profile.category}
                          </span>
                        </div>
                        <p className="text-[11px] text-zinc-400 mt-3 leading-relaxed">{profile.description}</p>
                      </div>

                      <div className="mt-4 pt-3 border-t border-zinc-900/60 flex items-center justify-between gap-2">
                        <div className="font-mono-custom text-xs font-bold text-zinc-300">ID: {profile.id}</div>
                        <button
                          onClick={() => handleDirectorySelect(profile)}
                          className="px-3 py-1.5 bg-white hover:bg-zinc-200 text-zinc-950 font-bold text-[10px] rounded-md transition-colors cursor-pointer"
                        >
                          Trích xuất mẫu
                        </button>
                      </div>
                    </div>
                  ))}

                  {filteredProfiles.length === 0 && (
                    <div className="col-span-full py-10 text-center text-xs text-zinc-500 font-mono-custom">
                      Không tìm thấy kết quả phù hợp cho tìm kiếm của bạn.
                    </div>
                  )}
                </div>
              </section>
            )}

            {/* TAB 4: DEEP LINKER */}
            {activeTab === "deep_linker" && (
              <section className="bg-zinc-950 border border-zinc-900 rounded-2xl p-6 shadow-xl space-y-6" id="deep-linker-panel">
                <div>
                  <h2 className="text-lg font-bold text-white flex items-center gap-2.5">
                    <Layers className="w-5 h-5 text-zinc-400" />
                    Chuyển Đổi ID Sang Deep-Link Ứng Dụng
                  </h2>
                  <p className="text-xs text-zinc-400 mt-1">
                    Nếu bạn đã có sẵn dãy số ID và muốn tạo liên kết nhấp chuột mở trực tiếp trong ứng dụng Facebook điện thoại hoặc ứng dụng quản lý, hãy nhập ID dưới đây.
                  </p>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                  <div className="md:col-span-1 space-y-4">
                    <div>
                      <label htmlFor="raw-id-input" className="block text-xs font-semibold text-zinc-400 mb-2 font-mono-custom uppercase tracking-wider">
                        Nhập Số ID Có Sẵn
                      </label>
                      <input
                        id="raw-id-input"
                        type="text"
                        placeholder="Ví dụ: 10008889999"
                        value={rawId}
                        onChange={(e) => setRawId(e.target.value)}
                        className="w-full bg-zinc-900 border border-zinc-800 rounded-lg py-2.5 px-3.5 text-xs text-white placeholder-zinc-500 focus:outline-none focus:border-zinc-700 font-mono-custom"
                      />
                    </div>

                    <div>
                      <span className="block text-xs font-semibold text-zinc-400 mb-2 font-mono-custom uppercase tracking-wider">
                        Loại Đối Tượng
                      </span>
                      <div className="grid grid-cols-2 gap-2">
                        {["profile", "page", "group", "event"].map((type) => (
                          <button
                            key={type}
                            onClick={() => setRawIdType(type as any)}
                            className={`py-2 px-3 text-[10px] font-bold uppercase rounded-lg border cursor-pointer transition-colors ${
                              rawIdType === type
                                ? "bg-zinc-800 border-zinc-700 text-white"
                                : "bg-zinc-950 border-zinc-900 text-zinc-500 hover:text-zinc-300"
                            }`}
                          >
                            {type}
                          </button>
                        ))}
                      </div>
                    </div>
                  </div>

                  {/* Generated Deep Links Output */}
                  <div className="md:col-span-2 bg-zinc-900/30 border border-zinc-900 rounded-xl p-5 flex flex-col justify-center">
                    {formattedLinks ? (
                      <div className="space-y-4">
                        <span className="text-[10px] uppercase tracking-wider font-mono-custom text-zinc-500 block font-semibold">Kết quả liên kết tương ứng:</span>
                        
                        <div className="space-y-3">
                          <div className="p-3 bg-zinc-950 border border-zinc-850 rounded-lg">
                            <div className="flex items-center justify-between mb-1.5">
                              <span className="text-[10px] font-mono-custom text-zinc-400 font-semibold flex items-center gap-1">
                                <Monitor className="w-3.5 h-3.5 text-zinc-500" />
                                Mở trên Web Trình duyệt (Web URL)
                              </span>
                              <button
                                onClick={() => copyToClipboard(formattedLinks.web, "rf-web")}
                                className="text-[10px] text-zinc-500 hover:text-white font-mono-custom cursor-pointer"
                              >
                                {copiedText === "rf-web" ? "Đã chép!" : "Sao chép"}
                              </button>
                            </div>
                            <code className="text-xs text-zinc-300 font-mono-custom select-all block truncate">{formattedLinks.web}</code>
                          </div>

                          <div className="p-3 bg-zinc-950 border border-zinc-850 rounded-lg">
                            <div className="flex items-center justify-between mb-1.5">
                              <span className="text-[10px] font-mono-custom text-zinc-400 font-semibold flex items-center gap-1">
                                <Smartphone className="w-3.5 h-3.5 text-zinc-500" />
                                Mở trực tiếp bằng App Điện thoại (fb:// scheme)
                              </span>
                              <button
                                onClick={() => copyToClipboard(formattedLinks.mobile, "rf-mob")}
                                className="text-[10px] text-zinc-500 hover:text-white font-mono-custom cursor-pointer"
                              >
                                {copiedText === "rf-mob" ? "Đã chép!" : "Sao chép"}
                              </button>
                            </div>
                            <code className="text-xs text-zinc-300 font-mono-custom select-all block truncate">{formattedLinks.mobile}</code>
                          </div>
                        </div>
                      </div>
                    ) : (
                      <div className="text-center py-8 text-xs text-zinc-500 font-mono-custom">
                        <Layers className="w-8 h-8 text-zinc-700 mx-auto mb-2" />
                        Nhập số ID bên trái để tạo mã liên kết tự động.
                      </div>
                    )}
                  </div>
                </div>
              </section>
            )}

          </div>

          {/* RIGHT COLUMN (1 COL): EDUCATIONAL ACCORDION & FAQS */}
          <div className="space-y-8">
            
            {/* Explanatory Vietnamese Widget */}
            <section className="bg-zinc-950 border border-zinc-900 rounded-2xl p-5 space-y-4">
              <h3 className="text-sm font-bold text-white flex items-center gap-2">
                <Sparkles className="w-4.5 h-4.5 text-amber-500" />
                Giải Đáp Yêu Cầu Của Bạn
              </h3>
              <p className="text-xs text-zinc-400 leading-relaxed">
                Khi bạn nhập bất kỳ liên kết nào, ví dụ như:
                <br />
                <code className="text-zinc-200 font-mono-custom bg-zinc-900/80 px-1 py-0.5 rounded block my-1.5 border border-zinc-800 break-all text-[11px]">
                  https://www.facebook.com/hieeus.mahask/
                </code>
                Công cụ của chúng tôi sẽ thực hiện theo 2 bước:
              </p>
              
              <ul className="space-y-2 text-xs text-zinc-400">
                <li className="flex items-start gap-2">
                  <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 mt-1.5 shrink-0"></span>
                  <span><strong>Bước 1:</strong> Hệ thống gửi yêu cầu lên máy chủ để tải mã nguồn trang đó về môi trường an toàn (Sandbox).</span>
                </li>
                <li className="flex items-start gap-2">
                  <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 mt-1.5 shrink-0"></span>
                  <span><strong>Bước 2:</strong> Áp dụng các quy tắc biểu thức chính quy (Regex) và công nghệ phân tích thông minh để trích xuất dãy số ID cá nhân thực ẩn sâu trong mã nguồn và hiển thị lại cho bạn.</span>
                </li>
              </ul>
            </section>

            {/* FAQS Accordion */}
            <section className="bg-zinc-950 border border-zinc-900 rounded-2xl p-5 space-y-4">
              <h3 className="text-sm font-bold text-white flex items-center gap-2">
                <HelpCircle className="w-4.5 h-4.5 text-zinc-400" />
                Câu Hỏi Thường Gặp (FAQs)
              </h3>

              <div className="space-y-2">
                {[
                  {
                    q: "Facebook ID là gì?",
                    a: "Mỗi tài khoản, fanpage hoặc nhóm trên Facebook khi tạo ra đều được gán một dãy số duy nhất và cố định trong hệ thống cơ sở dữ liệu. Ngay cả khi bạn thay đổi tên người dùng (username/vanity link), ID số này vẫn luôn giữ nguyên không đổi."
                  },
                  {
                    q: "Tại sao công cụ báo 'Cần lấy thủ công'?",
                    a: "Facebook áp dụng cơ chế chống quét dữ liệu tự động (Anti-Scrape / Bot detection). Khi họ phát hiện lượng truy cập đáng ngờ, họ sẽ yêu cầu đăng nhập. Lúc này, phương pháp xem nguồn trang (View Source) thủ công ở Tab 2 là cách hiệu quả nhất để vượt qua bộ lọc."
                  },
                  {
                    q: "Deep Link (fb://) dùng để làm gì?",
                    a: "Đây là đường dẫn đặc biệt giúp mở trực tiếp ứng dụng Facebook trên thiết bị di động (iOS/Android) thay vì mở trên trình duyệt web, giúp trải nghiệm của người dùng liền mạch hơn."
                  },
                  {
                    q: "Tại sao tôi không dùng được graph.facebook.com?",
                    a: "Kể từ bản cập nhật Graph API v2.0, Facebook đã ẩn dữ liệu người dùng công khai trừ khi bạn có Access Token được cấp quyền từ chính chủ tài khoản đó. Do đó, công cụ lấy ID này ra đời để giải quyết việc tra cứu ID phục vụ việc quảng cáo, tích hợp SDK."
                  }
                ].map((item, index) => (
                  <div key={index} className="border-b border-zinc-900 pb-2">
                    <button
                      onClick={() => setOpenFaq(openFaq === index ? null : index)}
                      className="w-full flex items-center justify-between text-left text-xs font-semibold py-2 text-zinc-300 hover:text-white transition-colors cursor-pointer"
                    >
                      <span>{item.q}</span>
                      <ChevronDown className={`w-3.5 h-3.5 text-zinc-500 transition-transform ${openFaq === index ? "rotate-180" : ""}`} />
                    </button>
                    {openFaq === index && (
                      <p className="text-[11px] text-zinc-400 leading-relaxed pb-2 pt-0.5 animate-fade-in">
                        {item.a}
                      </p>
                    )}
                  </div>
                ))}
              </div>
            </section>

          </div>

        </main>
      </div>

      {/* Footer Section */}
      <footer className="relative mt-16 border-t border-zinc-900 bg-zinc-950/40 py-8 z-10 text-center">
        <div className="max-w-6xl mx-auto px-4 flex flex-col sm:flex-row items-center justify-between gap-4 text-xs text-zinc-500">
          <p>© 2026 Facebook ID Finder. Designed with high fidelity.</p>
          <div className="flex gap-4 font-mono-custom text-[11px]">
            <span>Fast Lookup</span>
            <span>•</span>
            <span>Bilingual Support</span>
            <span>•</span>
            <span>AI Augmented</span>
          </div>
        </div>
      </footer>
    </div>
  );
}
