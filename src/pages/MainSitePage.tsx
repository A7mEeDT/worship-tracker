import Index from "./Index";
import MainToolbar from "@/components/main/MainToolbar";

export default function MainSitePage() {
  return (
    <>
      <MainToolbar />
      <div className="pt-16">
        <Index />
      </div>
    </>
  );
}
