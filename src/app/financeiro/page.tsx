import Financeiro from "@/components/Financeiro";

export const dynamic = "force-dynamic";

export const metadata = {
  title: "Marktiva — Financeiro",
  robots: { index: false, follow: false },
};

export default function PaginaFinanceiro() {
  return <Financeiro />;
}
