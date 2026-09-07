import express from "express";
import path from "path";
import { createServer as createViteServer } from "vite";
import multer from "multer";
import { GoogleGenAI, Type } from "@google/genai";
import dotenv from "dotenv";

dotenv.config();

const PORT = 3000;

// Multer setup for in-memory file storage
const upload = multer({ 
  storage: multer.memoryStorage(),
  limits: { fileSize: 25 * 1024 * 1024 } // Increase to 25MB
});

// Gemini Initialization
const ai = new GoogleGenAI({
  apiKey: process.env.GEMINI_API_KEY,
  httpOptions: {
    headers: {
      'User-Agent': 'aistudio-build',
    }
  }
});

async function startServer() {
  const app = express();
  const PORT = 3000;

  // Middleware
  app.use(express.json({ limit: '20mb' }));

  // API Endpoint for analyzing student record
  app.post("/api/analyze-record", upload.single("pdf"), async (req, res) => {
    console.log("Received analysis request. File:", req.file?.originalname, "Size:", req.file?.size);
    try {
      if (!req.file) {
        return res.status(400).json({ error: "No file uploaded" });
      }

      const major = req.body.major || "미정 (전체 분석)";

      const apiKey = process.env.GEMINI_API_KEY;
      if (!apiKey) {
        return res.status(500).json({ error: "GEMINI_API_KEY가 설정되지 않았습니다. 설정에서 API 키를 확인해 주세요." });
      }

      const pdfBase64 = req.file.buffer.toString("base64");

      const systemInstruction = `당신은 대한민국 최고 수준의 대학 입학 사정관이자 면접 전문가입니다. 
제공된 가이드북의 '질문 도출 3단계(시작 질문-교사평가-역량검증)'와 사용자가 제시한 '심화 질문 샘플'의 스타일을 결합하여 문항을 생성하십시오.

[질문 생성 스타일 가이드]:
1. **구체성**: "어떤 노력을 했나요?" 같은 막연한 질문은 금지합니다. 학생부에 기재된 구체적인 소재(예: 폴리올레핀, 수치해석, 파동함수 등)를 직접 인용하십시오.
2. **학술적 깊이**: 전공인 [${major}]의 핵심 원리와 연결하여 질문하십시오. (예: "~ 활동에서 ~ 소재를 선정했는데, ~ 환경에서의 ~ 저항성 측면에서 해당 소재가 갖는 구체적인 장점은 무엇입니까?")
3. **탐침 질문(Probing)**: 학생의 사고 임계치를 시험하는 날카로운 질문이어야 합니다. (예: "만약 ~ 상황이 발생한다면, 제시한 설계안을 공학적으로 어떻게 보완해야 안전성을 확보할 수 있겠습니까?")
4. **한국어 전용**: 모든 내용은 반드시 자연스러운 한국어로 작성하십시오.

[문항 구성]:
1. **공통 질문 (Common Questions)**: 학생부 전체를 관통하는 지원 동기, 인재상 적합성, 진로 계획, 대학 학업 이수 계획 등을 포함하여 5~7개 내외의 문항을 생성하십시오.
   - 예시: "모집단위에 왜 적합한 인재인지?", "지원동기는?", "졸업 후 진로와 대학 학업 계획은?", "해당학과의 특정 커리큘럼(트랙)과 본인의 관심 분야가 다를 때의 생각" 등
2. **서류 기반 심화 질문**: 창체, 교과세특 등 세부 항목별 질문

[항목별 준수 사항 (엄격 준수)]:
1. **창의적 체험활동**: 모든 학년의 각 영역(자율활동, 동아리활동, 진로활동)별로 **최소 1개 이상**의 문항을 반드시 생성하십시오. 
   - **중요**: 지원 전공[${major}]과 관련된 활동의 경우 반드시 **2개 이상의 심화 문항**을 생성하십시오.
   - **Category 명칭**: 반드시 "창의적 체험활동"으로 통일하십시오.
2. **교과세특**: 학생부에 기재된 **모든 학년의 모든 과목**에 대해 누락 없이 **과목당 최소 1개 이상**의 문항을 생성하십시오. 
   - **중요**: 지원 전공[${major}]과 관련된 교과(계열)라면 반드시 **과목당 2개 이상의 문항**을 생성하십시오.
3. **완결성**: 질문(question)과 탐침(probing_question)은 충분히 길고 전문적으로 작성하되, 의도(intent)와 총평(feedback)은 전체 응답이 끊기지 않도록 핵심만 1~2문장으로 간결하게 유지하십시오.`;

      console.log("Analyzing with Deep Academic & Strict Count Framework. Major:", major);
      
      let response;
      let retries = 0;
      const maxRetries = 2;
      
      while (retries <= maxRetries) {
        try {
          response = await ai.models.generateContent({
            model: "gemini-3-flash-preview",
            contents: [
              {
                inlineData: {
                  mimeType: "application/pdf",
                  data: pdfBase64,
                },
              },
              {
                text: `희망 학과: ${major}. 이 학생부를 분석해서 아래 규칙을 반드시 지켜서 공통 질문과 모든 학년(1, 2, 3학년) 항목별 질문을 생성해줘.
                
                [규칙]:
                1. 공통 질문: 5~7개 생성
                2. 창의적 체험활동: 모든 학년의 자율활동, 동아리활동, 진로활동 각 영역별로 1개 이상 생성 (전공 관련 시 2개 이상)
                3. 교과세특: 모든 과목당 1개 이상 생성 (전공 관련 교과/계열 시 2개 이상)
                
                분류(category) 필드는 반드시 "공통 질문", "창의적 체험활동", "교과세특", "행동발달 종합의견" 중 하나를 사용해줘.`,
              },
            ],
            config: {
              systemInstruction,
              responseMimeType: "application/json",
              maxOutputTokens: 16384,
              responseSchema: {
                type: Type.OBJECT,
                properties: {
                  candidate: { type: Type.STRING, description: "학생 이름" },
                  common_questions: {
                    type: Type.ARRAY,
                    items: {
                      type: Type.OBJECT,
                      properties: {
                        question: { type: Type.STRING, description: "공통 면접 질문" },
                        intent: { type: Type.STRING, description: "질문 의도 (간결하게)" },
                      },
                      required: ["question", "intent"],
                    },
                  },
                  questions: {
                    type: Type.ARRAY,
                    items: {
                      type: Type.OBJECT,
                      properties: {
                        category: { type: Type.STRING, description: "대분류" },
                        grade: { type: Type.STRING, description: "학년 (1학년, 2학년, 3학년)" },
                        subcategory: { type: Type.STRING, description: "상세분류 (자율활동, 동아리활동, 진로활동 또는 과목명)" },
                        evaluation_type: { type: Type.STRING, description: "학업역량/진로역량/공동체역량" },
                        question: { type: Type.STRING, description: "학술적이고 구체적인 심화 질문 (충분한 길이)" },
                        probing_question: { type: Type.STRING, description: "사고력을 요하는 날카로운 탐침 질문" },
                        intent: { type: Type.STRING, description: "질문 의도 (간결하게)" },
                      },
                      required: ["category", "grade", "subcategory", "evaluation_type", "question", "probing_question", "intent"],
                    },
                  },
                  feedback: { type: Type.STRING, description: "전체적인 분석 총평 (간결하게)" },
                },
                required: ["common_questions", "questions", "feedback"],
              },
            },
          });
          // If successful, break the loop
          break;
        } catch (apiError: any) {
          const isRateLimit = apiError.status === 429 || apiError.message?.includes("429") || apiError.message?.toLowerCase().includes("quota");
          
          if (isRateLimit && retries < maxRetries) {
            retries++;
            const delay = 15000 * retries; // Wait 15s then 30s
            console.warn(`Rate limit hit. Retrying in ${delay}ms... (Attempt ${retries}/${maxRetries})`);
            await new Promise(resolve => setTimeout(resolve, delay));
            continue;
          }
          // If not a rate limit or we've exhausted retries, throw
          throw apiError;
        }
      }

      if (!response) {
        throw new Error("AI 엔진이 응답을 생성하지 못했습니다.");
      }

      // Log finish reason to debug truncation
      const candidate0 = response.candidates?.[0];
      if (candidate0?.finishReason) {
        console.log("Gemini Finish Reason:", candidate0.finishReason);
        if (candidate0.finishReason === "MAX_TOKENS") {
          console.warn("Response was truncated due to token limit!");
        }
      }

      if (!response.text) {
        console.error("Gemini returned empty response. Safety reasons or internal error.");
        throw new Error("AI가 유효한 답변을 생성하지 못했습니다. (빈 응답)");
      }

      const resultText = response.text;
      console.log("AI analysis successful. Output length:", resultText.length);
      
        try {
          const parsedResult = JSON.parse(resultText);
          res.json(parsedResult);
        } catch (parseError: any) {
          console.warn("Initial JSON parse failed, attempting robust repair...");
          
          let repairedJson = resultText.replace(/```json/g, "").replace(/```/g, "").trim();
          
          // Better Repair Strategy: Fixed-length look-ahead/look-behind and stack-based closure
          const repairJsonString = (json: string): string => {
            let stack: string[] = [];
            let inString = false;
            let escaped = false;
            let lastValidIndex = -1;

            for (let i = 0; i < json.length; i++) {
              const char = json[i];
              
              if (escaped) {
                escaped = false;
                continue;
              }

              if (char === '\\') {
                escaped = true;
                continue;
              }

              if (char === '"') {
                inString = !inString;
                continue;
              }

              if (!inString) {
                if (char === '{' || char === '[') {
                  stack.push(char);
                } else if (char === '}' || char === ']') {
                  const top = stack[stack.length - 1];
                  if ((char === '}' && top === '{') || (char === ']' && top === '[')) {
                    stack.pop();
                  }
                }
              }
              lastValidIndex = i;
            }

            let result = json;
            
            // 1. Close string if it was open
            if (inString) {
              result += '"';
            }
            
            // 2. Pop stack and close containers
            while (stack.length > 0) {
              const top = stack.pop();
              if (top === '{') result += '}';
              else if (top === '[') result += ']';
            }
            
            return result;
          };

          try {
            const repaired = repairJsonString(repairedJson);
            console.log("Repaired JSON length:", repaired.length);
            const parsed = JSON.parse(repaired);
            res.json(parsed);
          } catch (repairError: any) {
            console.error("JSON Repair failed:", repairError.message);
            throw new Error(`AI의 응답이 너무 길어 처리가 중단되었습니다. 문항 당 답변을 더 짧게 적도록 설정을 조정하겠습니다. (오류: ${repairError.message})`);
          }
        }
    } catch (error: any) {
      console.error("Detailed Gemini analysis error:", {
        message: error.message,
        stack: error.stack,
        status: error.status,
      });
      
      let errorMessage = "파일 분석 중 오류가 발생했습니다.";
      let statusCode = 500;

      if (error.status === 429 || error.message?.includes("429") || error.message?.toLowerCase().includes("quota")) {
        errorMessage = "현재 AI 서비스 사용량이 많아 일시적으로 제한되었습니다. 약 30초~1분 후 다시 '분석 엔진 가동'을 눌러주세요.";
        statusCode = 429;
      } else if (error.message?.includes("403") || (error.status === 403)) {
        errorMessage = "API 접근 권한 문제가 발생했습니다. API 키나 모델 권한을 확인해 주세요.";
      } else if (error.message?.includes("413") || error.message?.includes("large")) {
        errorMessage = "파일 크기가 너무 큽니다. 더 작은 용량의 PDF를 사용해 주세요.";
      } else if (error.message?.includes("Safety")) {
        errorMessage = "안전 정책에 의해 분석이 차단되었습니다. 민감한 정보가 포함되어 있는지 확인해 주세요.";
      }
      
      res.status(statusCode).json({ 
        error: errorMessage, 
        details: error.message
      });
    }
  });

  // Health check
  app.get("/api/health", (req, res) => {
    res.json({ status: "ok" });
  });

  if (process.env.NODE_ENV !== "production") {
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: "spa",
    });
    app.use(vite.middlewares);
  } else {
    const distPath = path.join(process.cwd(), "dist");
    app.use(express.static(distPath));
    app.get("*", (req, res) => {
      res.sendFile(path.join(distPath, "index.html"));
    });
  }

  // Global error handler for JSON responses
  app.use((err: any, req: express.Request, res: express.Response, next: express.NextFunction) => {
    console.error("Global error handler:", err);
    res.status(err.status || 500).json({
      error: "서버 내부 오류가 발생했습니다.",
      details: err.message
    });
  });

  app.listen(PORT, "0.0.0.0", () => {
    console.log(`Server running on http://localhost:${PORT}`);
  }).setTimeout(300000); // 5 minute timeout for long PDF processing
}

startServer().catch(err => {
  console.error("Failed to start server:", err);
});
