import BillEditor from "@/components/BillEditor";
export const metadata = {
  title: "ลองแบ่งบิลตัวอย่าง",
  robots: { index: false, follow: false },
};
export default function Page() {
  return <BillEditor demo />;
}
