import { Link } from "wouter";
import { Button } from "@/components/ui/button";

export default function NotFound() {
  return (
    <div className="flex min-h-[60vh] flex-col items-center justify-center gap-4 px-4 text-center">
      <div className="text-6xl font-bold text-primary">404</div>
      <h1 className="text-2xl font-semibold text-foreground">Halaman tidak ditemukan</h1>
      <p className="text-muted-foreground">
        Halaman yang Anda cari tidak ada atau telah dipindahkan.
      </p>
      <Link href="/">
        <Button>Kembali ke Home</Button>
      </Link>
    </div>
  );
}
