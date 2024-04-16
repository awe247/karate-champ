import React from "react";

interface IPlayerDisplayProps {
  hairColor: string;
  skinColor: string;
  eyeColor: string;
  giColor: string;
}

export const PlayerDisplay = ({
  hairColor,
  skinColor,
  eyeColor,
  giColor,
}: IPlayerDisplayProps) => {
  return (
    <svg
      xmlns="http://www.w3.org/2000/svg"
      shapeRendering="crispEdges"
      viewBox="0 -0.5 22 39"
    >
      <path
        d="M7 0h6M6 1h1m6 0h2M4 2h2m9 0h4M3 3h1m15 0h1M2 4h1m17 0h1M0 5h2m17 0h3M1 6h1m16 0h1m2 0h1M2 7h1m16 0h1M2 8h1m16 0h1M1 9h1m5 0h1m3 0h2m5 0h3M0 10h1m5 0h1m1 0h1m1 0h1m2 0h2m2 0h1m1 0h2M1 11h2m2 0h2m2 0h2m4 0h1m1 0h1m2 0h1M3 12h2m1 0h1m3 0h1m4 0h2M4 13h1m3 0h5m3 0h1M4 14h1m4 0h1m3 0h1m2 0h1M3 15h4m6 0h1m2 0h1M2 16h1m2 0h1m1 0h1m7 0h1M2 17h1m2 0h1m1 0h3m4 0h2M1 18h1m2 0h1m2 0h1m2 0h4m1 0h1M1 19h1m2 0h1m3 0h1m3 0h1m2 0h1m1 0h4M0 20h1m1 0h4m3 0h3m2 0h1m1 0h1m1 0h1m2 0h1M0 21h2m2 0h1m1 0h1m7 0h1m1 0h1m1 0h1m2 0h1M0 22h1m3 0h1m1 0h1m6 0h1m2 0h3m2 0h1M0 23h1m4 0h12m1 0h1m2 0h1M1 24h1m3 0h9m3 0h4M2 25h3m2 0h5m2 0h1M4 26h1m2 0h2m1 0h2m3 0h1M4 27h2m1 0h2m1 0h2m2 0h1m1 0h1M4 28h1m1 0h8m2 0h1M3 29h1m6 0h1m6 0h1M3 30h1m5 0h1m1 0h1m5 0h1M2 31h1m5 0h1m3 0h1m4 0h1M2 32h1m5 0h1m3 0h1m4 0h1M1 33h1m5 0h1m4 0h6M1 34h6m5 0h1m4 0h1M0 35h1m5 0h1m5 0h1m4 0h1M0 36h1m4 0h1m6 0h1m5 0h1M0 37h1m4 0h1m7 0h6M0 38h6"
        stroke="#000"
      />
      <path
        d="M7 1h6M6 2h9M4 3h15M3 4h17M2 5h17M2 6h16M3 7h16M3 8h16M2 9h5m1 0h3m2 0h5M1 10h5m3 0h1m5 0h2M3 11h2m11 0h1"
        stroke={hairColor}
      />
      <path
        d="M7 10h1m3 0h2m-6 1h2m2 0h4M5 12h1m1 0h3m1 0h4M5 13h3m5 0h3M5 14h4m5 0h2m-9 1h3m4 0h2M3 16h2m3 0h7M3 17h2m5 0h4M2 18h2m4 0h2m-8 1h2m5 0h3M1 20h1m13 0h1m1 0h1m1 0h2M2 21h2m1 0h1m9 0h1m1 0h1m1 0h2M1 22h3m1 0h1m8 0h2m3 0h2M1 23h4m12 0h1m1 0h2M2 24h3m8 10h4M1 35h5m7 0h4M1 36h4m8 0h5M1 37h4"
        stroke={skinColor}
      />
      <path d="M10 14h1m-1 1h1" stroke="#fff" />
      <path d="M11 14h2m-2 1h2" stroke={eyeColor} />
      <path
        d="M6 16h1m-1 1h1m-2 1h2m7 0h1M5 19h3m5 0h2m-9 1h3m3 0h2m-7 1h7m-7 1h6m-8 3h2m5 0h2m-9 1h2m2 0h1m2 0h3m-9 1h1m2 0h1m2 0h2m1 0h1M5 28h1m8 0h2M4 29h6m1 0h6M4 30h5m3 0h5M3 31h5m5 0h4M3 32h5m5 0h4M2 33h5"
        stroke={giColor}
      />
    </svg>
  );
};
