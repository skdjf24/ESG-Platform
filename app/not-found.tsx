import Link from "next/link";
import { ArrowLeft, FileQuestion } from "lucide-react";
import { BrandMark } from "@/components/ui/brand-mark";

export default function NotFound() {
  return (
    <main className="grid min-h-screen place-items-center bg-[#f4f6f5] p-6">
      <div className="w-full max-w-md text-center">
        <div className="mb-10 flex justify-center"><BrandMark /></div>
        <div className="mx-auto grid size-16 place-items-center rounded-2xl border border-[#dfe6e2] bg-white text-[#176b52] shadow-sm"><FileQuestion className="size-7" /></div>
        <h1 className="mt-6 text-2xl font-semibold text-[#17231d]">页面不存在</h1>
        <p className="mt-2 text-sm leading-6 text-[#758078]">该报告项目或编制步骤不存在，请返回项目首页重新选择。</p>
        <Link href="/" className="mt-6 inline-flex h-10 items-center gap-2 rounded-lg bg-[#176b52] px-4 text-xs font-semibold text-white"><ArrowLeft className="size-3.5" />返回项目首页</Link>
      </div>
    </main>
  );
}
