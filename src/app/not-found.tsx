import { NotFoundContent } from "@/components/layout/not-found-content";

export const metadata = { title: "Page not found" };

// A web address that matches nothing at all: this page is the whole document body.
export default function NotFoundPage() {
  return <NotFoundContent asMain />;
}
