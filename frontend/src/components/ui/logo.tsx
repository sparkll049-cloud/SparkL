// frontend/src/components/ui/logo.tsx
import Image from "next/image";

export function Logo({ size = 60 }: { size?: number }) {
  return (
    <Image
      src="/images/logo.jpg"
      alt="SparkL"
      width={size}
      height={size}
      priority
      className="object-contain"
    />
  );
}