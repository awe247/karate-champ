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
    <svg width="100" height="100" viewBox="0 0 100 100">
      <circle cx="50" cy="50" r="40" fill={hairColor} />
      <rect x="10" y="10" width="80" height="80" fill={skinColor} />
      <text x="50" y="50" textAnchor="middle" fill={giColor}>
        Hello, SVG!
      </text>
    </svg>
  );
};
