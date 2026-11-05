import { useState, useEffect } from "react";
import { useNavigate, useParams } from "react-router-dom";
import { ArrowLeft, ThumbsUp, ThumbsDown, ChevronRight, CheckCircle2, Lightbulb, ZoomIn } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { Dialog, DialogContent } from "@/components/ui/dialog";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip";
import { HelpArticleLanguageSelector } from "@/components/help/HelpArticleLanguageSelector";
import { HelpArticleChat } from "@/components/help/HelpArticleChat";
import { useTranslation } from "react-i18next";
import { articlesDB } from "@/data/helpArticles";

export default function HelpArticle() {
  const { articleId } = useParams<{ articleId: string }>();
  const navigate = useNavigate();
  const [feedback, setFeedback] = useState<"up" | "down" | null>(null);
  const [feedbackSubmitted, setFeedbackSubmitted] = useState(false);
  const [lightboxImg, setLightboxImg] = useState<{ src: string; alt: string } | null>(null);
  const { i18n } = useTranslation();
  const [articleLang, setArticleLang] = useState(i18n.language?.split("-")[0] || "en");
  const [translatedSections, setTranslatedSections] = useState<Record<string, string> | null>(null);
  const [isTranslating, setIsTranslating] = useState(false);

  const article = articleId ? articlesDB[articleId] : null;

  useEffect(() => {
    if (!article || articleLang === "en") {
      setTranslatedSections(null);
      return;
    }
    
    const translateArticle = async () => {
      setIsTranslating(true);
      try {
        const textsToTranslate: string[] = [article.title, article.summary];
        article.sections.forEach((s) => {
          textsToTranslate.push(s.title);
          s.content.forEach((c) => textsToTranslate.push(c));
          s.steps?.forEach((st) => textsToTranslate.push(st));
          s.tips?.forEach((t) => textsToTranslate.push(t));
        });

        const { data, error } = await supabase.functions.invoke("translate-address", {
          body: { addresses: textsToTranslate, targetLanguage: articleLang },
        });

        if (!error && data?.translatedAddresses) {
          const map: Record<string, string> = {};
          textsToTranslate.forEach((orig, i) => {
            map[orig] = data.translatedAddresses[i] || orig;
          });
          setTranslatedSections(map);
        }
      } catch {
        // Silently fall back to English
      } finally {
        setIsTranslating(false);
      }
    };

    translateArticle();
  }, [articleLang, articleId]);

  const tx = (text: string) => {
    if (!translatedSections || articleLang === "en") return text;
    return translatedSections[text] || text;
  };

  const handleFeedback = async (type: "up" | "down") => {
    setFeedback(type);
    setFeedbackSubmitted(true);

    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (user) {
        await supabase.from("ai_feature_feedback").insert({
          user_id: user.id,
          feature: `help_article_${articleId}`,
          feedback_type: type === "up" ? "positive" : "negative",
        });
      }
    } catch {
      // silently fail
    }

    toast.success(type === "up" ? "Glad it helped! 🎉" : "Thanks for the feedback. We'll improve this.");
  };

  if (!article) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center">
        <div className="text-center space-y-3">
          <p className="text-muted-foreground">Article not found</p>
          <Button variant="outline" onClick={() => navigate("/help-center")}>
            Back to Help Center
          </Button>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background">
      {/* Header */}
      <div className="sticky top-0 z-10 bg-background/95 backdrop-blur border-b">
        <div className="max-w-2xl mx-auto px-4 py-3 flex items-center gap-3">
          <button onClick={() => navigate("/help-center")} className="p-1.5 rounded-lg hover:bg-muted">
            <ArrowLeft className="w-5 h-5 text-foreground" />
          </button>
          <div className="min-w-0 flex-1">
            <p className="text-xs text-primary font-medium">{article.category}</p>
            <h1 className="text-sm font-semibold text-foreground truncate">{tx(article.title)}</h1>
          </div>
          <HelpArticleLanguageSelector selectedLang={articleLang} onLangChange={setArticleLang} />
          {isTranslating && <span className="text-[10px] text-muted-foreground animate-pulse">Translating…</span>}
        </div>
      </div>

      {/* Content */}
      <div className="max-w-2xl mx-auto px-4 py-5 space-y-5">
        {/* Meta */}
        <div className="flex items-center gap-2 flex-wrap">
          <Badge variant="secondary" className="text-xs">{article.readTime}</Badge>
          <Badge variant="outline" className="text-xs">Updated {article.lastUpdated}</Badge>
        </div>

        {/* Summary */}
        <Card className="border-primary/20 bg-primary/5">
          <CardContent className="p-4">
            <p className="text-sm text-foreground leading-relaxed">{tx(article.summary)}</p>
          </CardContent>
        </Card>

        {/* Sections */}
        {article.sections.map((section, i) => (
          <div key={i} className="space-y-2.5">
            <div className="flex items-center gap-2">
              {section.icon && (
                <div className="p-1.5 rounded-md bg-primary/10 text-primary">
                  {section.icon}
                </div>
              )}
              <h2 className="font-semibold text-foreground text-[15px]">{tx(section.title)}</h2>
            </div>

            {section.content.map((para, j) => (
              <p key={j} className="text-sm text-muted-foreground leading-relaxed">{tx(para)}</p>
            ))}

            {section.steps && (
              <div className="space-y-1.5 ml-1">
                {section.steps.map((step, k) => (
                  <div key={k} className="flex gap-2.5 items-start">
                    <CheckCircle2 className="w-4 h-4 text-primary mt-0.5 shrink-0" />
                    <span className="text-sm text-foreground">{tx(step)}</span>
                  </div>
                ))}
              </div>
            )}

            {section.tips && (
              <div className="rounded-lg bg-amber-50 dark:bg-amber-950/30 border border-amber-200 dark:border-amber-800 p-3 space-y-1.5">
                <div className="flex items-center gap-1.5">
                  <Lightbulb className="w-3.5 h-3.5 text-amber-600" />
                  <span className="text-xs font-semibold text-amber-700 dark:text-amber-400">Tip</span>
                </div>
                {section.tips.map((tip, idx) => (
                  <p key={idx} className="text-xs text-amber-800 dark:text-amber-300 leading-relaxed">{tx(tip)}</p>
                ))}
              </div>
            )}

            {section.screenshot && (
              <button
                onClick={() => setLightboxImg(section.screenshot!)}
                className="group relative w-full rounded-xl overflow-hidden border border-border shadow-sm hover:shadow-md transition-shadow mt-2"
              >
                <img
                  src={section.screenshot.src}
                  alt={section.screenshot.alt}
                  className="w-full max-h-[400px] object-contain bg-muted/30"
                  loading="lazy"
                />
                <div className="absolute inset-0 bg-foreground/0 group-hover:bg-foreground/5 transition-colors flex items-center justify-center">
                  <div className="opacity-0 group-hover:opacity-100 transition-opacity bg-background/80 backdrop-blur-sm rounded-full p-2 shadow">
                    <ZoomIn className="w-5 h-5 text-foreground" />
                  </div>
                </div>
                {section.screenshot.caption && (
                  <div className="px-3 py-2 bg-muted/50 border-t border-border">
                    <p className="text-xs text-muted-foreground text-center">{section.screenshot.caption}</p>
                  </div>
                )}
              </button>
            )}

            {i < article.sections.length - 1 && <Separator className="mt-4" />}
          </div>
        ))}

        {/* Screenshot Lightbox */}
        <Dialog open={!!lightboxImg} onOpenChange={() => setLightboxImg(null)}>
          <DialogContent className="max-w-[95vw] max-h-[95vh] p-2 bg-background border-border">
            {lightboxImg && (
              <img
                src={lightboxImg.src}
                alt={lightboxImg.alt}
                className="max-w-full max-h-[85vh] object-contain mx-auto rounded"
              />
            )}
          </DialogContent>
        </Dialog>

        {/* Feedback */}
        <Card className="border-muted">
          <CardContent className="p-4 text-center space-y-3">
            <p className="text-sm font-medium text-foreground">Was this article helpful?</p>
            {feedbackSubmitted ? (
              <div className="flex items-center justify-center gap-2 text-sm text-muted-foreground">
                {feedback === "up" ? (
                  <ThumbsUp className="w-5 h-5 text-primary fill-primary" />
                ) : (
                  <ThumbsDown className="w-5 h-5 text-destructive fill-destructive" />
                )}
                <span>Thanks for your feedback!</span>
              </div>
            ) : (
              <div className="flex items-center justify-center gap-3">
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => handleFeedback("up")}
                  className="gap-1.5 hover:bg-primary/10 hover:text-primary hover:border-primary"
                >
                  <ThumbsUp className="w-4 h-4" /> Yes, helpful
                </Button>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => handleFeedback("down")}
                  className="gap-1.5 hover:bg-destructive/10 hover:text-destructive hover:border-destructive"
                >
                  <ThumbsDown className="w-4 h-4" /> Not helpful
                </Button>
              </div>
            )}
          </CardContent>
        </Card>

        {/* Navigation with Tooltips */}
        <TooltipProvider>
          <div className="flex items-center justify-between gap-3 pb-6">
            {article.prevArticle ? (
              <Tooltip>
                <TooltipTrigger asChild>
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={() => navigate(`/help-center/${article.prevArticle!.id}`)}
                    className="text-xs gap-1 text-muted-foreground"
                  >
                    <ArrowLeft className="w-3.5 h-3.5" />
                    <span className="max-w-[120px] truncate">{article.prevArticle.title}</span>
                  </Button>
                </TooltipTrigger>
                <TooltipContent side="top">
                  <p className="text-xs">{article.prevArticle.title}</p>
                </TooltipContent>
              </Tooltip>
            ) : <div />}
            {article.nextArticle && (
              <Tooltip>
                <TooltipTrigger asChild>
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={() => navigate(`/help-center/${article.nextArticle!.id}`)}
                    className="text-xs gap-1 text-muted-foreground"
                  >
                    <span className="max-w-[120px] truncate">{article.nextArticle.title}</span>
                    <ChevronRight className="w-3.5 h-3.5" />
                  </Button>
                </TooltipTrigger>
                <TooltipContent side="top">
                  <p className="text-xs">{article.nextArticle.title}</p>
                </TooltipContent>
              </Tooltip>
            )}
          </div>
        </TooltipProvider>
      </div>

      {/* Chat Widget */}
      <HelpArticleChat articleTitle={article.title} articleCategory={article.category} />
    </div>
  );
}
