import React, { useState, useRef, useEffect } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { Upload, FileText, Brain, ChevronRight, Loader2, CheckCircle2, AlertCircle, Bookmark, BookmarkCheck, Trash2, Download } from 'lucide-react';
import html2canvas from 'html2canvas';
import { jsPDF } from 'jspdf';

interface CommonQuestion {
  question: string;
  intent: string;
}

interface Question {
  category: string;
  grade: string;
  subcategory: string;
  evaluation_type: string;
  question: string;
  probing_question: string;
  intent: string;
}

interface AnalysisResult {
  candidate?: string;
  common_questions: CommonQuestion[];
  questions: Question[];
  feedback: string;
}

export default function App() {
  const [file, setFile] = useState<File | null>(null);
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState<AnalysisResult | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [targetMajor, setTargetMajor] = useState<string>('');
  const [activeTab, setActiveTab] = useState<string>('공통 질문');
  const [activeGrade, setActiveGrade] = useState<string>('1학년');
  const [activeSub, setActiveSub] = useState<string | null>(null);
  const [savedQuestions, setSavedQuestions] = useState<Question[]>([]);
  const [showSavedOnly, setShowSavedOnly] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const categories = ['공통 질문', '창의적 체험활동', '교과세특', '행동발달 종합의견'];
  const grades = ['1학년', '2학년', '3학년'];

  // Load saved questions from localStorage
  useEffect(() => {
    const saved = localStorage.getItem('prepai_saved_questions');
    if (saved) {
      try {
        setSavedQuestions(JSON.parse(saved));
      } catch (e) {
        console.error('Failed to parse saved questions', e);
      }
    }
  }, []);

  // Save to localStorage whenever savedQuestions changes
  useEffect(() => {
    localStorage.setItem('prepai_saved_questions', JSON.stringify(savedQuestions));
  }, [savedQuestions]);

  const getEvaluationColor = (type: string) => {
    switch(type) {
      case '학업역량': return 'text-blue-700 bg-blue-50 border-blue-200';
      case '진로역량': return 'text-amber-700 bg-amber-50 border-amber-200';
      case '공동체역량': return 'text-emerald-700 bg-emerald-50 border-emerald-200';
      default: return 'text-slate-700 bg-slate-100 border-slate-200';
    }
  };

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files[0]) {
      const selectedFile = e.target.files[0];
      setFile(selectedFile);
      setResult(null);
      setError(null);
    }
  };

  const handleUploadClick = () => {
    fileInputRef.current?.click();
  };

  const [isExporting, setIsExporting] = useState(false);
  const [isTxtExporting, setIsTxtExporting] = useState(false);

  const handleDownloadTXT = () => {
    if (!result) return;
    setIsTxtExporting(true);
    
    try {
      let content = `[PrepAI] 학생부 면접 분석 리포트\n`;
      content += `====================================\n`;
      content += `학생명: ${result.candidate || '익명'}\n`;
      content += `희망전공: ${targetMajor || '미설정'}\n`;
      content += `분석일자: ${new Date().toLocaleString()}\n`;
      content += `====================================\n\n`;
      
      content += `[AI 총평]\n${result.feedback}\n\n`;
      
      if (result.common_questions && result.common_questions.length > 0) {
        content += `[공통 질문]\n`;
        result.common_questions.forEach((q, idx) => {
          content += `  Q${idx + 1}. ${q.question}\n`;
          content += `  ↳ 의도: ${q.intent}\n\n`;
        });
        content += `------------------------------------\n\n`;
      }
      
      const grades = ['1학년', '2학년', '3학년'];
      const categories = ['창의적 체험활동', '교과세특', '행동발달 종합의견'];
      
      const normalizeCat = (c: string) => {
        if (c === '창체' || c === '창의적 체험활동' || c === '창의적체험활동') return '창의적 체험활동';
        return c;
      };

      grades.forEach(grade => {
        const gradeQs = result.questions.filter(q => q.grade === grade);
        if (gradeQs.length === 0) return;
        
        content += `\n### ${grade}\n`;
        content += `------------------------------------\n`;
        
        categories.forEach(cat => {
          const catQs = gradeQs.filter(q => normalizeCat(q.category) === cat);
          if (catQs.length === 0) return;
          
          content += `\n[${cat}]\n`;
          
          const subs = Array.from(new Set<string>(catQs.map(q => q.subcategory)));
          const sortedSubs = [...subs].sort((a, b) => {
            if (cat === '창의적 체험활동') {
              const order = ['자율', '동아리', '진로', '봉사'];
              const aIdx = order.findIndex(o => a.includes(o));
              const bIdx = order.findIndex(o => b.includes(o));
              if (aIdx !== -1 && bIdx !== -1) return aIdx - bIdx;
              if (aIdx !== -1) return -1;
              if (bIdx !== -1) return 1;
            }
            return a.localeCompare(b);
          });

          sortedSubs.forEach(sub => {
            const subQs = catQs.filter(q => q.subcategory === sub);
            content += `  <${sub}>\n`;
            
            subQs.forEach((q, idx) => {
              content += `    Q${idx + 1}. ${q.question} [${q.evaluation_type || '역량'}]\n`;
              if (q.probing_question) {
                content += `    ↳ 탐침: ${q.probing_question}\n`;
              }
              if (q.intent) {
                content += `    (의도: ${q.intent})\n\n`;
              }
            });
          });
        });
      });
      
      const blob = new Blob([content], { type: 'text/plain;charset=utf-8' });
      const url = URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.href = url;
      link.download = `PrepAI_면접질문_${result.candidate || '익명'}.txt`;
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      URL.revokeObjectURL(url);
    } catch (err) {
      console.error('TXT export failed:', err);
      alert('TXT 생성 중 오류가 발생했습니다.');
    } finally {
      setIsTxtExporting(false);
    }
  };

  const handleDownloadPDF = async () => {
    if (!result) return;
    setIsExporting(true);
    
    try {
      const element = document.getElementById('pdf-export-content');
      if (!element) return;
      
      // Temporary style adjustments for capture
      const originalStyle = element.style.display;
      element.style.display = 'block';
      element.style.position = 'absolute';
      element.style.left = '-9999px';
      
      const canvas = await html2canvas(element, {
        scale: 2,
        useCORS: true,
        logging: false,
        backgroundColor: '#FFFFFF'
      });
      
      const imgData = canvas.toDataURL('image/png');
      const pdf = new jsPDF('p', 'mm', 'a4');
      const imgProps = pdf.getImageProperties(imgData);
      const pdfWidth = pdf.internal.pageSize.getWidth();
      const pdfHeight = (imgProps.height * pdfWidth) / imgProps.width;
      
      let heightLeft = pdfHeight;
      let position = 0;
      
      pdf.addImage(imgData, 'PNG', 0, position, pdfWidth, pdfHeight);
      heightLeft -= pdf.internal.pageSize.getHeight();
      
      while (heightLeft >= 0) {
        position = heightLeft - pdfHeight;
        pdf.addPage();
        pdf.addImage(imgData, 'PNG', 0, position, pdfWidth, pdfHeight);
        heightLeft -= pdf.internal.pageSize.getHeight();
      }
      
      pdf.save(`PrepAI_분석리포트_${result.candidate || '익명'}.pdf`);
      element.style.display = originalStyle;
    } catch (err) {
      console.error('PDF export failed:', err);
      alert('PDF 생성 중 오류가 발생했습니다.');
    } finally {
      setIsExporting(false);
    }
  };

  const toggleSaveQuestion = (q: Question) => {
    const isSaved = savedQuestions.some(sq => sq.question === q.question);
    if (isSaved) {
      setSavedQuestions(savedQuestions.filter(sq => sq.question !== q.question));
    } else {
      setSavedQuestions([...savedQuestions, q]);
    }
  };

  const isQuestionSaved = (q: Question) => savedQuestions.some(sq => sq.question === q.question);

  const handleAnalyze = async () => {
    if (!file) return;

    setLoading(true);
    setError(null);
    const formData = new FormData();
    formData.append('pdf', file);
    formData.append('major', targetMajor);

    try {
      const response = await fetch('/api/analyze-record', {
        method: 'POST',
        body: formData,
      });

      const contentType = response.headers.get("content-type");
      if (!contentType || !contentType.includes("application/json")) {
        throw new Error("서버에서 올바르지 않은 응답을 받았습니다.");
      }

      const data = await response.json();
      
      if (!response.ok) {
        if (response.status === 429) {
          throw new Error("현재 서버 부하가 많아 AI가 대기 중입니다. 약 1분 후 자동으로 재시도하거나 다시 시도해 주세요.");
        }
        throw new Error(data.details || data.error || '분석 중 오류가 발생했습니다.');
      }

      setResult(data);
      setShowSavedOnly(false);
    } catch (err: any) {
      if (err.name === 'TypeError' && err.message === 'Failed to fetch') {
        setError("서버와의 연결이 끊겼거나 응답 시간이 초과되었습니다. 대용량 파일의 경우 분석에 시간이 걸릴 수 있으니 잠시 후 다시 시도해 주세요.");
      } else {
        setError(err.message);
      }
    } finally {
      setLoading(false);
    }
  };

  return (
    <div id="app-root" className="min-h-screen bg-slate-50 text-slate-800 font-sans selection:bg-emerald-100 selection:text-emerald-900">
      <nav id="main-nav" className="border-b border-slate-200 bg-white/90 backdrop-blur-md sticky top-0 z-50 shadow-xs">
        <div className="max-w-7xl mx-auto px-6 py-4 flex items-center justify-between">
          <div id="brand-logo" className="flex items-center gap-3 cursor-pointer group" onClick={() => { setFile(null); setResult(null); setError(null); setShowSavedOnly(false); }}>
            <div className="w-10 h-10 bg-emerald-600 rounded-xl flex items-center justify-center text-white shadow-md shadow-emerald-600/20 group-hover:scale-105 transition-transform duration-200">
              <Brain className="w-6 h-6" />
            </div>
            <div>
              <h1 className="text-lg font-black text-slate-900 tracking-tight flex items-center gap-2">
                PrepAI <span className="text-[11px] font-bold text-emerald-700 bg-emerald-50 px-2 py-0.5 rounded-md border border-emerald-200">면접 연구소</span>
              </h1>
              <p className="text-[11px] text-slate-500 font-medium">대입 심층 구술 면접 질문 생성기</p>
            </div>
          </div>
          <div className="flex gap-3 text-sm font-semibold">
            <button 
              onClick={() => setShowSavedOnly(false)} 
              className={`px-3 py-1.5 rounded-lg transition-colors ${!showSavedOnly ? 'bg-emerald-50 text-emerald-700 font-bold' : 'text-slate-600 hover:text-slate-900'}`}
            >
              분석 대시보드
            </button>
            <button 
              onClick={() => setShowSavedOnly(true)} 
              className={`flex items-center gap-2 px-3 py-1.5 rounded-lg transition-colors ${showSavedOnly ? 'bg-emerald-50 text-emerald-700 font-bold' : 'text-slate-600 hover:text-slate-900'}`}
            >
              저장된 문항 {savedQuestions.length > 0 && <span className="px-1.5 py-0.5 rounded-full bg-emerald-100 text-xs font-bold text-emerald-800">{savedQuestions.length}</span>}
            </button>
          </div>
        </div>
      </nav>

      <main id="main-content" className="max-w-7xl mx-auto px-6 py-10">
        <AnimatePresence mode="wait">
          {!result && !loading && !showSavedOnly && (
            <motion.div
              key="hero"
              initial={{ opacity: 0, y: 15 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.98 }}
              className="min-h-[65vh] flex flex-col items-center justify-center text-center px-4"
            >
              <div className="w-20 h-20 bg-emerald-50 rounded-3xl flex items-center justify-center mx-auto mb-6 border border-emerald-100 shadow-sm">
                <Brain className="w-10 h-10 text-emerald-600" />
              </div>
              <div className="space-y-3">
                <h1 className="text-3xl md:text-5xl font-black tracking-tight text-slate-900 leading-tight">
                  생활기록부 기반 <span className="text-emerald-600">심층 면접 질문</span> 생성
                </h1>
                <p className="text-slate-600 max-w-lg mx-auto text-sm md:text-base font-normal leading-relaxed">
                  지원 희망 학과와 생활기록부(PDF)를 등록하면, 입학사정관의 관점에서 <br className="hidden md:inline"/>
                  공통 질문 및 학년별(1·2·3학년) 창체·교과세특 심층 질문을 분석합니다.
                </p>
                
                <div className="mt-10 bg-white p-8 md:p-10 rounded-3xl border border-slate-200 shadow-sm max-w-xl mx-auto w-full space-y-6 text-left">
                  <div className="space-y-2">
                    <label className="text-xs font-bold text-slate-700 flex items-center gap-2">
                      <span className="w-2 h-2 rounded-full bg-emerald-500"></span>
                      희망 학과 / 모집단위
                    </label>
                    <input 
                      type="text" 
                      value={targetMajor}
                      onChange={(e) => setTargetMajor(e.target.value)}
                      placeholder="예: 컴퓨터공학과, 경영학과, 의예과, 건축학과"
                      className="w-full bg-slate-50 border border-slate-300 rounded-xl px-5 py-3.5 text-sm text-slate-900 placeholder:text-slate-400 focus:outline-none focus:ring-2 focus:ring-emerald-500/20 focus:border-emerald-600 transition-all font-semibold"
                    />
                  </div>
                  
                  <div 
                    onClick={handleUploadClick}
                    className={`relative cursor-pointer border-2 border-dashed rounded-2xl p-8 transition-all duration-200 text-center ${file ? 'border-emerald-500 bg-emerald-50/50' : 'border-slate-300 bg-slate-50/60 hover:border-emerald-500 hover:bg-emerald-50/30'}`}
                  >
                    <input type="file" className="hidden" accept=".pdf" onChange={handleFileChange} ref={fileInputRef} />
                    <div className="flex flex-col items-center gap-3">
                      <div className={`w-12 h-12 rounded-xl flex items-center justify-center transition-colors ${file ? 'bg-emerald-600 text-white' : 'bg-slate-200 text-slate-600'}`}>
                        {file ? <CheckCircle2 className="w-6 h-6" /> : <Upload className="w-6 h-6" />}
                      </div>
                      <div>
                        <p className="text-base font-bold text-slate-900">{file ? file.name : "학생부 PDF 파일 업로드"}</p>
                        <p className="text-xs text-slate-500 font-medium mt-1">{file ? `${(file.size / 1024 / 1024).toFixed(2)} MB` : "클릭하거나 파일을 이곳에 끌어다 놓으세요"}</p>
                      </div>
                    </div>
                  </div>

                  {file && (
                    <motion.button 
                      initial={{ opacity: 0, y: 10 }}
                      animate={{ opacity: 1, y: 0 }}
                      onClick={handleAnalyze}
                      disabled={loading}
                      className="w-full py-4 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white font-bold shadow-md hover:shadow-lg transition-all flex items-center justify-center gap-2 text-base group cursor-pointer"
                    >
                      분석 엔진 가동
                      <ChevronRight className="w-5 h-5 group-hover:translate-x-1 transition-transform" />
                    </motion.button>
                  )}

                  {error && (
                    <div className="p-3 bg-red-50 border border-red-200 rounded-xl flex items-start gap-2 text-red-700 text-xs font-semibold">
                      <AlertCircle className="w-4 h-4 shrink-0 mt-0.5" />
                      <span>{error}</span>
                    </div>
                  )}
                </div>
              </div>
            </motion.div>
          )}

          {loading && (
            <motion.div 
              key="loading"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              className="min-h-[60vh] flex flex-col items-center justify-center text-center"
            >
              <div className="relative mb-8">
                <div className="w-20 h-20 border-4 border-slate-200 border-t-emerald-600 rounded-full animate-spin"></div>
                <Brain className="w-8 h-8 text-emerald-600 absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 animate-pulse" />
              </div>
              <div className="space-y-2">
                <h3 className="text-xl font-black text-slate-900">AI가 생활기록부를 심층 분석하는 중입니다</h3>
                <p className="text-slate-500 text-sm font-medium">활동의 진위성, 전공 연계성, 학업 역량에 맞춘 질문을 도출하고 있습니다...</p>
              </div>
            </motion.div>
          )}

          {(result || showSavedOnly) && !loading && (
            <motion.section
              key={showSavedOnly ? "saved" : "results"}
              initial={{ opacity: 0, x: 10 }}
              animate={{ opacity: 1, x: 0 }}
              className="space-y-8"
            >
              {!showSavedOnly && result && (
                <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
                  {/* Analysis Hub (Left) */}
                  <div className="lg:col-span-1 bg-white p-6 rounded-2xl border border-slate-200 shadow-sm space-y-4">
                    <div className="flex items-center justify-between">
                      <h3 className="text-xs font-bold text-emerald-700 uppercase tracking-wider">분석 기본 정보</h3>
                      <button onClick={() => { setFile(null); setResult(null); }} className="text-xs text-slate-500 hover:text-slate-800 font-semibold underline transition-colors">새로 분석</button>
                    </div>
                    
                    <div className="space-y-3">
                      <div className="bg-slate-50 p-4 rounded-xl border border-slate-200/80">
                        <p className="text-xs font-medium text-slate-500 mb-1">희망 전공</p>
                        <p className="text-base font-extrabold text-slate-900">{targetMajor || '미지정'}</p>
                      </div>
                      
                      <div className="bg-slate-50 p-4 rounded-xl border border-slate-200/80 flex items-center justify-between">
                        <div>
                          <p className="text-xs font-medium text-slate-500 mb-1">업로드 문서</p>
                          <p className="text-xs font-bold text-slate-800 truncate max-w-[180px]">{file?.name}</p>
                        </div>
                        <span className="px-2 py-1 rounded bg-emerald-100 text-[11px] font-bold text-emerald-800">PDF</span>
                      </div>
                    </div>
                  </div>

                  {/* AI Insight (Right) */}
                  <div className="lg:col-span-2 bg-white p-6 rounded-2xl border border-slate-200 shadow-sm flex flex-col justify-between">
                    <div className="flex items-center justify-between mb-4">
                      <h3 className="text-xs font-bold text-indigo-700 uppercase tracking-wider">AI 입학사정관 총평 및 분석 개요</h3>
                      <div className="flex gap-4">
                        <div className="text-right">
                          <span className="text-xs text-slate-500 font-medium">대상: </span>
                          <span className="text-xs font-extrabold text-slate-900">{result.candidate || '학생'}</span>
                        </div>
                        <div className="text-right">
                          <span className="text-xs text-slate-500 font-medium">도출 문항: </span>
                          <span className="text-xs font-extrabold text-emerald-700">총 {result.questions.length}개</span>
                        </div>
                      </div>
                    </div>
                    
                    <div className="flex items-start gap-4 bg-indigo-50/60 p-5 rounded-xl border border-indigo-100">
                      <div className="w-10 h-10 bg-indigo-100 rounded-xl flex items-center justify-center shrink-0">
                        <Brain className="w-5 h-5 text-indigo-600" />
                      </div>
                      <p className="text-sm text-slate-700 font-medium leading-relaxed">
                        "{result.feedback}"
                      </p>
                    </div>
                  </div>
                </div>
              )}

              {showSavedOnly && (
                <div className="bg-white p-6 rounded-2xl border border-slate-200 shadow-sm">
                  <div className="flex items-center gap-3 mb-3">
                    <Bookmark className="w-6 h-6 text-emerald-600" />
                    <div>
                      <h2 className="text-xl font-bold text-slate-900 tracking-tight">저장된 면접 질문함</h2>
                      <p className="text-xs text-slate-500 font-medium">스크랩한 질문 리스트를 확인하고 관리할 수 있습니다.</p>
                    </div>
                  </div>
                  {savedQuestions.length === 0 && (
                    <div className="py-16 text-center">
                      <p className="text-slate-500 font-medium text-sm">저장된 질문이 없습니다. 분석 리포트에서 필요한 질문 우측 북마크를 눌러 저장해 보세요.</p>
                    </div>
                  )}
                </div>
              )}

              {/* Main Report Area */}
              {!showSavedOnly && (
                <div className="space-y-8">
                  <div className="flex flex-col md:flex-row md:items-center justify-between gap-3 py-4 border-b border-slate-200">
                    <div>
                      <h2 className="text-2xl font-black text-slate-900 tracking-tight flex items-center gap-3">
                        <FileText className="w-7 h-7 text-emerald-600" />
                        영역별 면접 질문 및 검증 전략
                      </h2>
                      <p className="text-xs text-slate-500 font-medium mt-1">생활기록부 세부 영역별 핵심 예상 질문과 후속 탐침 질문</p>
                    </div>
                  </div>

                  {/* Main Tab Switcher */}
                  <div className="flex p-1.5 bg-slate-200/70 rounded-2xl border border-slate-300/70 max-w-2xl mx-auto shadow-inner">
                    {categories.map(cat => (
                      <button
                        key={cat}
                        onClick={() => { setActiveTab(cat); setActiveSub(null); }}
                        className={`flex-1 py-3 px-4 rounded-xl text-xs md:text-sm font-bold transition-all duration-200 whitespace-nowrap ${activeTab === cat ? 'bg-white text-emerald-800 shadow-sm border border-slate-200/80 font-black' : 'text-slate-600 hover:text-slate-900 hover:bg-white/50'}`}
                      >
                        {cat}
                      </button>
                    ))}
                  </div>

                  {/* Secondary Controls - Grade and Flow */}
                  <div className="space-y-4">
                    {activeTab !== '공통 질문' && (
                      <div className="flex items-center justify-center">
                        <div className="flex p-1 bg-slate-100 rounded-xl border border-slate-200 shadow-xs">
                          {grades.map(grade => (
                            <button
                              key={grade}
                              onClick={() => { setActiveGrade(grade); setActiveSub(null); }}
                              className={`py-2 px-6 rounded-lg text-xs font-bold transition-all ${activeGrade === grade ? 'bg-white text-slate-900 shadow-sm' : 'text-slate-500 hover:text-slate-800'}`}
                            >
                              {grade}
                            </button>
                          ))}
                        </div>
                      </div>
                    )}

                    {activeTab === '교과세특' && result && (
                      <motion.div 
                        initial={{ opacity: 0, y: 6 }}
                        animate={{ opacity: 1, y: 0 }}
                        className="flex flex-wrap p-2.5 bg-slate-100/80 rounded-2xl justify-center gap-2 max-w-4xl mx-auto border border-slate-200"
                      >
                        {Array.from(new Set(result.questions.filter(q => q.category === '교과세특' && q.grade === activeGrade).map(q => q.subcategory))).map(sub => (
                          <button
                            key={sub}
                            onClick={() => setActiveSub(sub)}
                            className={`py-2 px-4 rounded-xl text-xs font-bold transition-all border ${activeSub === sub || (activeSub === null && Array.from(new Set(result.questions.filter(q => q.category === '교과세특' && q.grade === activeGrade).map(q => q.subcategory)))[0] === sub) ? 'bg-indigo-600 text-white border-indigo-600 shadow-sm' : 'bg-white text-slate-600 border-slate-200 hover:bg-slate-50 hover:text-slate-900'}`}
                          >
                            {sub}
                          </button>
                        ))}
                      </motion.div>
                    )}
                  </div>
                </div>
              )}

              {/* Questions Header with PDF Download */}
              <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 my-6">
                <div className="flex items-center gap-3">
                  <div className="h-6 w-1 bg-emerald-600 rounded-full"></div>
                  <div>
                    <h3 className="text-xl font-bold text-slate-900">{activeTab} 질문 리스트</h3>
                    <p className="text-xs text-slate-500 font-medium">
                      분석 결과 ({
                        result.questions.filter(q => {
                          const normalizeCat = (cat: string) => {
                            if (cat === '창체' || cat === '창의적 체험활동' || cat === '창의적체험활동') return '창의적 체험활동';
                            return cat;
                          };
                          return normalizeCat(q.category) === normalizeCat(activeTab);
                        }).length
                      }개 문항 발굴)
                    </p>
                  </div>
                </div>
                
                <div className="flex items-center gap-3">
                  <button 
                    onClick={handleDownloadTXT} 
                    disabled={isTxtExporting}
                    className="flex items-center gap-2 bg-white text-slate-700 hover:bg-slate-50 px-4 py-2.5 rounded-xl text-xs font-bold transition-all border border-slate-300 shadow-xs active:scale-95 disabled:opacity-50"
                  >
                    {isTxtExporting ? <Loader2 className="w-4 h-4 animate-spin text-slate-600" /> : <FileText className="w-4 h-4 text-slate-600" />}
                    TXT 저장
                  </button>
                  <button 
                    onClick={handleDownloadPDF} 
                    disabled={isExporting}
                    className="flex items-center gap-2 bg-emerald-600 hover:bg-emerald-700 text-white px-5 py-2.5 rounded-xl text-xs font-bold transition-all shadow-sm hover:shadow active:scale-95 disabled:opacity-50"
                  >
                    {isExporting ? <Loader2 className="w-4 h-4 animate-spin text-white" /> : <Download className="w-4 h-4 text-white" />}
                    전체 질문 PDF 저장
                  </button>
                </div>
              </div>

              {/* Questions Grid */}
              <div className="grid grid-cols-1 gap-6">
                {activeTab === '공통 질문' ? (
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                    {result?.common_questions.map((q, idx) => (
                      <motion.div
                        key={idx}
                        initial={{ opacity: 0, scale: 0.98 }}
                        animate={{ opacity: 1, scale: 1 }}
                        className="bg-white p-6 md:p-8 rounded-2xl border border-slate-200 shadow-sm space-y-5 hover:border-emerald-300 hover:shadow-md transition-all"
                      >
                        <div className="flex gap-3.5 items-start">
                          <div className="w-7 h-7 rounded-full bg-emerald-600 text-white flex items-center justify-center shrink-0 mt-0.5 text-xs font-bold shadow-xs">
                            {idx + 1}
                          </div>
                          <h5 className="text-base md:text-lg font-bold text-slate-900 leading-relaxed">
                            "{q.question}"
                          </h5>
                        </div>
                        <div className="flex items-start gap-3.5 bg-slate-50 p-4 rounded-xl border border-slate-200">
                          <Brain className="w-4 h-4 text-emerald-600 shrink-0 mt-0.5" />
                          <div className="space-y-0.5">
                            <p className="text-[11px] font-bold text-emerald-700 uppercase tracking-wider">질문 출제 의도</p>
                            <p className="text-xs text-slate-600 font-normal leading-relaxed">{q.intent}</p>
                          </div>
                        </div>
                      </motion.div>
                    ))}
                  </div>
                ) : (() => {
                  const displayQuestions = showSavedOnly 
                    ? savedQuestions 
                    : (result?.questions || []).filter(q => {
                        const normalizeCat = (cat: string) => {
                          if (cat === '창체' || cat === '창의적 체험활동' || cat === '창의적체험활동') return '창의적 체험활동';
                          return cat;
                        };
                        const catMatch = normalizeCat(q.category) === normalizeCat(activeTab);
                        const gradeMatch = q.grade === activeGrade;
                        if (activeTab === '교과세특') {
                          const availableSubs = Array.from(new Set((result?.questions || []).filter(sq => normalizeCat(sq.category) === '교과세특' && sq.grade === activeGrade).map(sq => sq.subcategory)));
                          const currentSub = activeSub || availableSubs[0];
                          return catMatch && gradeMatch && q.subcategory === currentSub;
                        }
                        return catMatch && gradeMatch;
                      });

                  if (displayQuestions.length === 0) {
                    return (
                      <div className="py-16 text-center space-y-3 bg-white rounded-2xl border border-slate-200">
                        <AlertCircle className="w-10 h-10 text-slate-400 mx-auto" />
                        <p className="text-slate-600 font-semibold text-sm">해당 항목에 분석된 문항이 없습니다.</p>
                      </div>
                    );
                  }

                  return (
                    <div className="space-y-8">
                      {(() => {
                        const subcatsInView = Array.from(new Set(displayQuestions.map(q => q.subcategory)));
                        return subcatsInView.map((sub) => {
                          const subQs = displayQuestions.filter(q => q.subcategory === sub);
                          return (
                            <div key={sub} className="space-y-4 relative">
                              <div className="flex items-center gap-4">
                                <h4 className="text-xs font-bold text-indigo-700 bg-indigo-50 px-4 py-1.5 rounded-full border border-indigo-200 uppercase tracking-wider">
                                  {sub}
                                </h4>
                                <div className="flex-1 h-px bg-slate-200"></div>
                              </div>
                              <div className="grid grid-cols-1 gap-4">
                                {subQs.map((q) => (
                                  <motion.div
                                    layout
                                    key={q.question}
                                    id={`q-${q.question}`}
                                    initial={{ opacity: 0, y: 8 }}
                                    animate={{ opacity: 1, y: 0 }}
                                    className="group bg-white p-6 md:p-8 rounded-2xl border border-slate-200 shadow-sm hover:border-emerald-300 hover:shadow-md transition-all duration-300 flex flex-col md:flex-row gap-6"
                                  >
                                    <div className="flex-1 space-y-6">
                                      <div className="flex justify-between items-start">
                                        <div className="flex items-center gap-2">
                                          <span className={`text-[11px] font-bold px-3 py-1 rounded-full border shadow-xs ${getEvaluationColor(q.evaluation_type)}`}>
                                            {q.evaluation_type}
                                          </span>
                                          {showSavedOnly && (
                                             <span className="text-[11px] font-bold px-3 py-1 rounded-full bg-slate-100 text-slate-600 border border-slate-200">
                                               {q.category} · {q.grade}
                                             </span>
                                          )}
                                        </div>
                                        <button 
                                          onClick={() => toggleSaveQuestion(q)}
                                          className={`p-2 rounded-xl transition-all cursor-pointer ${isQuestionSaved(q) ? 'bg-emerald-50 text-emerald-700 border border-emerald-200' : 'bg-slate-50 text-slate-400 hover:text-slate-700 border border-slate-200'}`}
                                          title={isQuestionSaved(q) ? "저장 취소" : "질문 저장"}
                                        >
                                          {isQuestionSaved(q) ? <BookmarkCheck className="w-4 h-4" /> : <Bookmark className="w-4 h-4" />}
                                        </button>
                                      </div>

                                      <div className="space-y-4">
                                        <div className="flex gap-3.5 items-start">
                                          <div className="w-7 h-7 rounded-full bg-emerald-100 text-emerald-800 flex items-center justify-center shrink-0 mt-0.5 font-black text-xs">
                                            Q
                                          </div>
                                          <h5 className="text-base md:text-lg font-bold text-slate-900 leading-relaxed">
                                            "{q.question}"
                                          </h5>
                                        </div>

                                        {q.probing_question && (
                                          <div className="ml-10 p-4 bg-indigo-50/70 rounded-xl border border-indigo-100/80 relative overflow-hidden group/probe">
                                            <div className="absolute top-0 left-0 w-1 h-full bg-indigo-500"></div>
                                            <div className="flex items-center gap-2 mb-1.5">
                                              <AlertCircle className="w-3.5 h-3.5 text-indigo-600" />
                                              <p className="text-[11px] font-bold text-indigo-700 uppercase tracking-wider">탐침(Probing) 질문</p>
                                            </div>
                                            <p className="text-xs md:text-sm font-medium text-slate-800 leading-relaxed">
                                              "{q.probing_question}"
                                            </p>
                                          </div>
                                        )}
                                      </div>
                                    </div>
                                    
                                    <div className="md:w-1/3 bg-slate-50 p-5 rounded-xl border border-slate-200 group-hover:bg-slate-100/70 transition-colors flex flex-col justify-center">
                                      <div className="flex items-center gap-2 mb-2">
                                        <Brain className="w-4 h-4 text-emerald-700" />
                                        <p className="text-[11px] font-bold text-emerald-700 uppercase tracking-wider">입학사정관 체크포인트</p>
                                      </div>
                                      <p className="text-xs text-slate-600 leading-relaxed font-normal">
                                        {q.intent}
                                      </p>
                                    </div>
                                  </motion.div>
                                ))}
                              </div>
                            </div>
                          );
                        });
                      })()}
                    </div>
                  );
                })()}
              </div>
            </motion.section>
          )}
        </AnimatePresence>

        <footer className="mt-16 pt-8 border-t border-slate-200 flex flex-col md:flex-row justify-between items-center gap-4 text-xs font-medium text-slate-500">
          <div className="flex items-center gap-3">
            <span>보안 정책: 파일 암호화 분석</span>
            <span className="w-1 h-1 rounded-full bg-slate-300"></span>
            <span>분석 엔진: Gemini AI</span>
          </div>
          <div className="flex gap-6">
            <span>대입 학생부 종합전형 심층 구술 면접 지원</span>
            <span className="text-slate-400">© PrepAI</span>
          </div>
        </footer>
      </main>

      {/* Hidden PDF Export Content */}
      {result && (
        <div 
          id="pdf-export-content" 
          style={{ 
            display: 'none', 
            width: '800px', 
            padding: '36px 44px', 
            backgroundColor: '#FFFFFF', 
            color: '#111827',
            fontFamily: '-apple-system, BlinkMacSystemFont, "Malgun Gothic", "맑은 고딕", "Apple SD Gothic Neo", sans-serif',
            lineHeight: '1.5'
          }}
        >
          {/* Document Header */}
          <div style={{ borderBottom: '2px solid #111827', paddingBottom: '12px', marginBottom: '20px' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-end' }}>
              <div>
                <h1 style={{ color: '#111827', fontSize: '18px', fontWeight: '800', margin: '0 0 4px 0', letterSpacing: '-0.02em' }}>
                  학생부 기반 대입 심층 면접 질문 리포트
                </h1>
                <p style={{ color: '#4B5563', fontSize: '11.5px', margin: 0 }}>
                  수험생: <strong style={{ color: '#111827' }}>{result.candidate || '학생'}</strong> &nbsp;|&nbsp; 
                  희망 모집단위: <strong style={{ color: '#111827' }}>{targetMajor || '미지정'}</strong>
                </p>
              </div>
              <div style={{ textAlign: 'right', color: '#6B7280', fontSize: '10.5px' }}>
                <p style={{ margin: '0 0 2px 0' }}>PrepAI 면접 분석 시스템</p>
                <p style={{ margin: 0 }}>발행일: {new Date().toLocaleDateString('ko-KR')}</p>
              </div>
            </div>
          </div>

          {/* AI Feedback Summary */}
          {result.feedback && (
            <div style={{ marginBottom: '20px', padding: '10px 14px', backgroundColor: '#F9FAFB', borderRadius: '6px', border: '1px solid #E5E7EB' }}>
              <div style={{ fontSize: '11px', fontWeight: '700', color: '#059669', marginBottom: '3px' }}>
                [총평] AI 면접관 종합 분석 의견
              </div>
              <p style={{ color: '#374151', fontSize: '11.5px', lineHeight: '1.55', margin: 0 }}>
                {result.feedback}
              </p>
            </div>
          )}

          {/* Common Questions */}
          {result.common_questions && result.common_questions.length > 0 && (
            <div style={{ marginBottom: '24px' }}>
              <div style={{ 
                borderBottom: '1.5px solid #374151', 
                paddingBottom: '4px', 
                marginBottom: '10px',
                display: 'flex',
                justifyContent: 'space-between',
                alignItems: 'baseline'
              }}>
                <span style={{ fontSize: '13px', fontWeight: '800', color: '#111827' }}>■ 공통 질문 (소양 및 학업 계획)</span>
                <span style={{ fontSize: '11px', color: '#6B7280' }}>총 {result.common_questions.length}개 문항</span>
              </div>
              <div style={{ display: 'grid', gap: '8px' }}>
                {result.common_questions.map((q, idx) => (
                  <div key={idx} style={{ 
                    padding: '8px 12px', 
                    backgroundColor: '#F9FAFB', 
                    borderRadius: '4px', 
                    border: '1px solid #E5E7EB' 
                  }}>
                    <p style={{ color: '#111827', fontSize: '12px', fontWeight: '700', margin: '0 0 3px 0', lineHeight: '1.5' }}>
                      Q{idx + 1}. {q.question}
                    </p>
                    <p style={{ color: '#4B5563', fontSize: '11px', margin: 0, lineHeight: '1.4' }}>
                      <span style={{ color: '#6B7280', fontWeight: '600' }}>↳ 의도: </span>{q.intent}
                    </p>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Grade Questions (1학년, 2학년, 3학년) */}
          {[ '1학년', '2학년', '3학년' ].map(grade => {
            const gradeQuestions = result.questions.filter(q => q.grade === grade);
            if (gradeQuestions.length === 0) return null;

            const normalizeCat = (c: string) => {
              if (c === '창체' || c === '창의적 체험활동' || c === '창의적체험활동') return '창의적 체험활동';
              return c;
            };

            const categoriesInOrder = ['창의적 체험활동', '교과세특', '행동발달 종합의견'];

            return (
              <div key={grade} style={{ marginBottom: '24px' }}>
                {/* Grade Header */}
                <div style={{ 
                  backgroundColor: '#F3F4F6', 
                  borderLeft: '4px solid #111827', 
                  padding: '5px 10px', 
                  marginBottom: '12px' 
                }}>
                  <span style={{ fontSize: '13px', fontWeight: '800', color: '#111827' }}>■ {grade}</span>
                </div>

                {categoriesInOrder.map(cat => {
                  const catQuestions = gradeQuestions.filter(q => normalizeCat(q.category) === cat);
                  if (catQuestions.length === 0) return null;

                  // Order subcategories: for 창체, 자율 -> 동아리 -> 진로
                  const rawSubs = Array.from(new Set<string>(catQuestions.map(q => q.subcategory)));
                  const sortedSubs = [...rawSubs].sort((a, b) => {
                    if (cat === '창의적 체험활동') {
                      const order = ['자율', '동아리', '진로', '봉사'];
                      const aIdx = order.findIndex(o => a.includes(o));
                      const bIdx = order.findIndex(o => b.includes(o));
                      if (aIdx !== -1 && bIdx !== -1) return aIdx - bIdx;
                      if (aIdx !== -1) return -1;
                      if (bIdx !== -1) return 1;
                    }
                    return a.localeCompare(b);
                  });

                  const catThemeColor = cat === '창의적 체험활동' ? '#047857' : cat === '교과세특' ? '#1D4ED8' : '#6D28D9';
                  const catLabel = cat === '창의적 체험활동' 
                    ? '창의적 체험활동 (자율, 동아리, 진로)' 
                    : cat === '교과세특' 
                    ? '교과세특' 
                    : '행동발달 종합의견';

                  return (
                    <div key={cat} style={{ marginLeft: '6px', marginBottom: '16px' }}>
                      {/* Category Header */}
                      <div style={{ 
                        fontSize: '12px', 
                        fontWeight: '800', 
                        color: catThemeColor, 
                        borderBottom: '1px solid #E5E7EB',
                        paddingBottom: '3px',
                        marginBottom: '8px'
                      }}>
                        ▶ {catLabel}
                      </div>

                      {/* Subcategories (e.g. 자율활동, 동아리활동, 진로활동 or 과목명) */}
                      {sortedSubs.map(sub => {
                        const subQs = catQuestions.filter(q => q.subcategory === sub);
                        return (
                          <div key={sub} style={{ marginBottom: '10px', paddingLeft: '8px' }}>
                            <div style={{ 
                              fontSize: '11.5px', 
                              fontWeight: '700', 
                              color: '#374151', 
                              marginBottom: '6px' 
                            }}>
                              [{sub}]
                            </div>

                            {/* Question items */}
                            <div style={{ display: 'grid', gap: '6px' }}>
                              {subQs.map((q, idx) => (
                                <div key={idx} style={{ 
                                  paddingBottom: '6px', 
                                  borderBottom: '1px dashed #E5E7EB' 
                                }}>
                                  <div style={{ display: 'flex', alignItems: 'baseline', gap: '6px' }}>
                                    {q.evaluation_type && (
                                      <span style={{ 
                                        fontSize: '9.5px', 
                                        fontWeight: '700', 
                                        color: catThemeColor, 
                                        backgroundColor: '#F3F4F6', 
                                        padding: '1px 4px', 
                                        borderRadius: '3px',
                                        flexShrink: 0
                                      }}>
                                        {q.evaluation_type}
                                      </span>
                                    )}
                                    <p style={{ color: '#111827', fontSize: '12px', fontWeight: '700', margin: 0, lineHeight: '1.5' }}>
                                      Q{idx + 1}. {q.question}
                                    </p>
                                  </div>

                                  {q.probing_question && (
                                    <p style={{ color: '#374151', fontSize: '11.5px', margin: '3px 0 0 10px', lineHeight: '1.5' }}>
                                      <strong style={{ color: '#4B5563' }}>↳ 탐침: </strong>{q.probing_question}
                                    </p>
                                  )}

                                  {q.intent && (
                                    <p style={{ color: '#6B7280', fontSize: '11px', margin: '2px 0 0 10px', lineHeight: '1.4' }}>
                                      <span style={{ color: '#9CA3AF' }}>↳ 의도: </span>{q.intent}
                                    </p>
                                  )}
                                </div>
                              ))}
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  );
                })}
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
