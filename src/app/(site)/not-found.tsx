import { NotFoundContent } from "@/components/layout/not-found-content";

export const metadata = { title: "Page not found" };

// A missing page inside the public site: it sits inside the site layout's own <main>.
export default function SiteNotFoundPage() {
  return <NotFoundContent asMain={false} />;
}
