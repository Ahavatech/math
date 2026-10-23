"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { RichTextEditor } from "@/components/admin/rich-text-editor";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import { Alert, AlertDescription } from "@/components/ui/alert";
import {
  createArticleAction,
  updateArticleAction,
  checkDuplicateArticleAction,
} from "@/server/actions/journal-articles";
import { ARTICLE_TYPES } from "@/lib/validators/journal";
import { ArticlePdfUpload } from "./article-pdf-upload";
import { PublishingChecklist } from "./publishing-checklist";

type Author = { name: string; affiliation: string; orcid: string; email: string; userId: string };

type ArticleData = {
  id?: string;
  title: string;
  abstract: string;
  keywords: string[];
  authors: Author[];
  issueId: string | null;
  pageStart: number | null;
  pageEnd: number | null;
  type: string;
  doi: string;
  license: string;
  receivedAt: string | null;
  acceptedAt: string | null;
  status: "DRAFT" | "SCHEDULED" | "PUBLISHED" | "CORRECTED" | "RETRACTED";
  hasPdf?: boolean;
};

export function ArticleForm({ article, issues }: { article?: ArticleData; issues: { id: string; volume: number; number: number }[] }) {
  const router = useRouter();
  const [abstract, setAbstract] = useState(article?.abstract ?? "");
  const [authors, setAuthors] = useState<Author[]>(
    article?.authors.length ? article.authors : [{ name: "", affiliation: "", orcid: "", email: "", userId: "" }],
  );
  const [title, setTitle] = useState(article?.title ?? "");
  const [issueId, setIssueId] = useState(article?.issueId ?? "");
  const [duplicateWarning, setDuplicateWarning] = useState<string | null>(null);
  const [result, setResult] = useState<{ error?: string; success?: boolean } | null>(null);
  const [pending, startTransition] = useTransition();

  async function checkDuplicate() {
    const dup = await checkDuplicateArticleAction(title, issueId || null);
    setDuplicateWarning(dup);
  }

  function save(formData: FormData) {
    formData.set("abstract", abstract);
    if (article?.id) formData.set("id", article.id);
    startTransition(async () => {
      const action = article?.id ? updateArticleAction : createArticleAction;
      const res = await action(undefined, formData);
      setResult(res);
      if (!res.error && !article?.id && res.id) router.push(`/admin/journal/articles/${res.id}`);
      else if (!res.error) router.refresh();
    });
  }

  return (
    <form action={save} className="max-w-2xl space-y-5">
      {article?.id ? <PublishingChecklist articleId={article.id} /> : null}
      {duplicateWarning ? (
        <Alert variant="destructive">
          <AlertDescription>
            An article titled &quot;{duplicateWarning}&quot; already exists in this issue. Save anyway if this is intentional.
          </AlertDescription>
        </Alert>
      ) : null}

      <div className="space-y-1.5">
        <Label htmlFor="title">Title</Label>
        <Input id="title" name="title" value={title} onChange={(e) => setTitle(e.target.value)} onBlur={checkDuplicate} required />
      </div>

      <div className="space-y-1.5">
        <Label>Abstract</Label>
        <RichTextEditor initialHtml={abstract} onChange={setAbstract} existingMedia={[]} />
      </div>

      <div className="space-y-1.5">
        <Label htmlFor="keywords">Keywords (comma-separated, up to 10)</Label>
        <Input id="keywords" name="keywords" defaultValue={article?.keywords.join(", ") ?? ""} />
      </div>

      <div className="space-y-2">
        <Label>Authors (in order)</Label>
        {authors.map((author, i) => (
          <div key={i} className="grid grid-cols-5 gap-2">
            <Input placeholder="Name" name="authorName" defaultValue={author.name} className="col-span-2" />
            <Input placeholder="Affiliation" name="authorAffiliation" defaultValue={author.affiliation} />
            <Input placeholder="ORCID" name="authorOrcid" defaultValue={author.orcid} />
            <div className="flex gap-1">
              <Input placeholder="Email (private)" name="authorEmail" defaultValue={author.email} />
              <input type="hidden" name="authorUserId" value={author.userId} />
              <Button type="button" variant="ghost" size="sm" onClick={() => setAuthors((prev) => prev.filter((_, idx) => idx !== i))}>×</Button>
            </div>
          </div>
        ))}
        <Button
          type="button"
          variant="outline"
          size="sm"
          disabled={authors.length >= 20}
          onClick={() => setAuthors((prev) => [...prev, { name: "", affiliation: "", orcid: "", email: "", userId: "" }])}
        >
          Add author
        </Button>
      </div>

      <div className="grid gap-3 sm:grid-cols-3">
        <div className="space-y-1.5">
          <Label htmlFor="issueId">Issue (optional - &quot;online first&quot;)</Label>
          <select id="issueId" name="issueId" value={issueId} onChange={(e) => setIssueId(e.target.value)} className="h-9 w-full rounded-md border border-input bg-background px-2 text-sm">
            <option value="">None (online first)</option>
            {issues.map((i) => (
              <option key={i.id} value={i.id}>Vol. {i.volume}, No. {i.number}</option>
            ))}
          </select>
        </div>
        <div className="space-y-1.5">
          <Label htmlFor="pageStart">Page start</Label>
          <Input id="pageStart" name="pageStart" type="number" defaultValue={article?.pageStart ?? ""} />
        </div>
        <div className="space-y-1.5">
          <Label htmlFor="pageEnd">Page end</Label>
          <Input id="pageEnd" name="pageEnd" type="number" defaultValue={article?.pageEnd ?? ""} />
        </div>
      </div>

      <div className="grid gap-3 sm:grid-cols-2">
        <div className="space-y-1.5">
          <Label htmlFor="type">Article type</Label>
          <select id="type" name="type" defaultValue={article?.type ?? "RESEARCH_ARTICLE"} className="h-9 w-full rounded-md border border-input bg-background px-2 text-sm">
            {ARTICLE_TYPES.map((t) => (
              <option key={t} value={t}>{t.replace(/_/g, " ").toLowerCase()}</option>
            ))}
          </select>
        </div>
        <div className="space-y-1.5">
          <Label htmlFor="doi">DOI (optional)</Label>
          <Input id="doi" name="doi" placeholder="10.xxxx/..." defaultValue={article?.doi ?? ""} />
        </div>
      </div>

      <div className="grid gap-3 sm:grid-cols-3">
        <div className="space-y-1.5">
          <Label htmlFor="license">Licence (optional, overrides the journal default)</Label>
          <Input id="license" name="license" defaultValue={article?.license ?? ""} />
        </div>
        <div className="space-y-1.5">
          <Label htmlFor="receivedAt">Received</Label>
          <Input id="receivedAt" name="receivedAt" type="date" defaultValue={article?.receivedAt?.slice(0, 10) ?? ""} />
        </div>
        <div className="space-y-1.5">
          <Label htmlFor="acceptedAt">Accepted</Label>
          <Input id="acceptedAt" name="acceptedAt" type="date" defaultValue={article?.acceptedAt?.slice(0, 10) ?? ""} />
        </div>
      </div>

      {article?.id ? <ArticlePdfUpload articleId={article.id} hasPdf={!!article.hasPdf} /> : (
        <p className="text-sm text-muted-foreground">Save the article first, then upload its PDF.</p>
      )}

      <div className="space-y-1.5">
        <Label htmlFor="status">Status</Label>
        <select id="status" name="status" defaultValue={article?.status ?? "DRAFT"} className="h-9 w-full rounded-md border border-input bg-background px-2 text-sm">
          <option value="DRAFT">Draft</option>
          <option value="SCHEDULED">Scheduled</option>
          <option value="PUBLISHED">Published</option>
          <option value="CORRECTED">Corrected</option>
          <option value="RETRACTED">Retracted</option>
        </select>
      </div>

      {result?.error ? <Alert variant="destructive"><AlertDescription>{result.error}</AlertDescription></Alert> : null}
      {result?.success ? <Alert><AlertDescription>Saved.</AlertDescription></Alert> : null}
      <Button type="submit" disabled={pending}>{pending ? "Saving..." : "Save"}</Button>
    </form>
  );
}
