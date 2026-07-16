import Image from "next/image";

/** FleetPanda Academy mark. */
export default function Logo({ size = 32 }: { size?: number }) {
  return (
    <Image
      src="/logo.png"
      alt="FleetPanda Academy"
      width={size}
      height={size}
      priority
    />
  );
}
