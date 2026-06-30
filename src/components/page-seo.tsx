import { useEffect } from "react";

interface PageSeoProps {
  title: string;
  description?: string;
}

export function PageSeo({ title, description }: PageSeoProps) {
  useEffect(() => {
    document.title = `${title} | Toto Macau Live`;
    if (description) {
      let meta = document.querySelector<HTMLMetaElement>('meta[name="description"]');
      if (!meta) {
        meta = document.createElement("meta");
        meta.name = "description";
        document.head.appendChild(meta);
      }
      meta.content = description;
    }
  }, [title, description]);

  return null;
}
