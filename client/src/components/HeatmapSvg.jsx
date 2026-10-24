import React from "react";

export default function HeatmapSvg({ students = false, total = null, easy = 0, boring = 0, engaging = 0, difficult = 0, easyAll = 0, boringAll = 0, engagingAll = 0, difficultAll = 0, threshold = 50, active = {} }) {
  // const easyDifficultSum = easyAll + difficultAll;
  // const boringEngagingSum = boringAll + engagingAll;
  const totalSum = students ? total : easyAll + difficultAll + boringAll + engagingAll;
  const pDifficult = totalSum > 0 ? Math.round((difficultAll * 100) / totalSum) : 0;
  const pEasy = totalSum > 0 ? Math.round((easyAll * 100) / totalSum) : 0;
  const pBoring = totalSum > 0 ? Math.round((boringAll * 100) / totalSum) : 0;
  const pEngaging = totalSum > 0 ? Math.round((engagingAll * 100) / totalSum) : 0;

  const greatestPercentage = Math.max.apply(Math, [pDifficult, pEasy, pBoring, pEngaging]);

  const percentageDifficult = greatestPercentage > 0 ? Math.round((pDifficult * 100) / greatestPercentage) : 0;
  const percentageEasy = greatestPercentage > 0 ? Math.round((pEasy * 100) / greatestPercentage) : 0;
  const percentageBoring = greatestPercentage > 0 ? Math.round((pBoring * 100) / greatestPercentage) : 0;
  const percentageEngaging = greatestPercentage > 0 ? Math.round((pEngaging * 100) / greatestPercentage) : 0;

  const difficultBarPosition = { y: 168.2 - (percentageDifficult || 0), h: percentageDifficult || 0 };
  const easyBarPosition = { y: 168.19, h: percentageEasy || 0 };
  const boringBarPosition = { y: 145.51, h: percentageBoring || 0, transform: "translate(298.11 38.28) rotate(90)" };
  const engagingBarPosition = { y: 141.63 - (percentageEngaging || 0), h: percentageEngaging || 0, transform: "translate(294.22 -10.97) rotate(90)" };

  const difficultActive = active.net_difficult || active.difficult;
  const easyActive = active.net_difficult || active.easy;
  const boringActive = active.net_engaging || active.boring;
  const engagingActive = active.net_engaging || active.engaging;

  return (
    <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 326.23 338.75">
      <style>
        {`.svgtextdiv { 
          height: 100%;
          width: 100%;
          text-align: center;
        }`}
      </style>
      <path d="M252.6,168.19a100,100,0,1,1-100-100A100,100,0,0,1,252.6,168.19Z" fill="none" stroke="#e9e9e9" />
      {/* <circle cx="152.6" cy="168.19" r={getRadius()} fill="none" stroke="#c84747" strokeWidth="2px" /> */}
      <g>
        <line x1="152.6" y1="69.23" x2="152.6" y2="267.16" fill="none" stroke="#6d6d6d" strokeMiterlimit="10" />
        <line x1="251.57" y1="168.19" x2="53.63" y2="168.19" fill="none" stroke="#6d6d6d" strokeMiterlimit="10" />
      </g>
      <g>
        <g>
          <rect x="172.98" y={engagingBarPosition.y} width="12.37" height={engagingBarPosition.h} transform={engagingBarPosition.transform} fill="#69b9a6" opacity={engagingActive ? 1 : 0.2} />
          <rect x="146.41" y={difficultBarPosition.y} width="12.37" height={difficultBarPosition.h} fill="#ff7785" opacity={difficultActive ? 1 : 0.2} />
        </g>
        <rect x="123.73" y={boringBarPosition.y} width="12.37" height={boringBarPosition.h} transform={boringBarPosition.transform} fill="#9F8CFF" fillOpacity={boringActive ? 1 : 0.2} />
        <rect x="146.41" y={easyBarPosition.y} width="12.37" height={easyBarPosition.h} fill="#ffbc55" opacity={easyActive ? 1 : 0.2} />
      </g>
      <g opacity={difficultActive ? 1 : 0.2}>
        <rect x="133.6" y="40.19" width="38" height="21" rx="5.5" fill="#ff7785" stroke="#e9e9e9" />
        {/* <rect x="133.6" y="18.19" width="38" height="21" rx="5.5" fill="#ff7785" stroke="#e9e9e9" opacity="0.35" style={{ isolation: "isolate" }} /> */}
        <text transform="translate(126.52 31.92)" fontSize="16px" fontFamily="ArialMT, Arial">
          Difficult
        </text>
        <text transform="translate(140.57 54.98)" fontSize="12px" fontFamily="ArialMT, Arial">
          <tspan>{pDifficult}%</tspan>
        </text>
        {/* <text transform="translate(135.71 32.81)" fontSize="12px" fontFamily="ArialMT, Arial">
          <tspan>n = {difficult < 10 ? `0${difficult}` : difficult}</tspan>
        </text> */}
      </g>
      <g opacity={boringActive ? 1 : 0.2}>
        <rect x="4.13" y="157.93" width="38" height="21" rx="5.5" fill="#9F8CFF" stroke="#e9e9e9" />
        {/* <rect x="4.13" y="179.93" width="38" height="21" rx="5.5" fill="#9F8CFF" stroke="#e9e9e9" opacity="0.35" style={{ isolation: "isolate" }} /> */}
        <text transform="translate(0 149.19)" fontSize="16px" fontFamily="ArialMT, Arial">
          Boring
        </text>
        <text transform="translate(11.09 172.71)" fontSize="12px" fontFamily="ArialMT, Arial">
          <tspan>{pBoring}%</tspan>
        </text>
        {/* <text transform="translate(6.23 194.54)" fontSize="12px" fontFamily="ArialMT, Arial">
          <tspan>n = {boring < 10 ? `0${boring}` : boring}</tspan>
        </text> */}
      </g>
      <g opacity={easyActive ? 1 : 0.2}>
        <rect x="133.6" y="274.19" width="38" height="21" rx="5.5" fill="#ffbc55" stroke="#e9e9e9" />
        {/* <rect x="133.6" y="296.19" width="38" height="21" rx="5.5" fill="#ffbc55" stroke="#e9e9e9" opacity="0.35" style={{ isolation: "isolate" }} /> */}
        <text transform="translate(134.81 311.56)" fontSize="16px" fontFamily="ArialMT, Arial">
          Easy
        </text>
        <text transform="translate(140.57 288.98)" fontSize="12px" fontFamily="ArialMT, Arial">
          <tspan>{pEasy}%</tspan>
        </text>
        {/* <text transform="translate(135.71 310.81)" fontSize="12px" fontFamily="ArialMT, Arial">
          <tspan>n = {easy < 10 ? `0${easy}` : easy}</tspan>
        </text> */}
      </g>
      <g opacity={engagingActive ? 1 : 0.2}>
        <rect x="273.92" y="157.93" width="37" height="21" rx="5.5" fill="#69b9a6" stroke="#f3f3f3" />
        {/* <rect x="273.92" y="179.93" width="37" height="21" rx="5.5" fill="#69b9a6" stroke="#f3f3f3" opacity="0.35" style={{ isolation: "isolate" }} /> */}
        <text transform="translate(258.61 149.19)" fontSize="16px" fontFamily="ArialMT, Arial">
          Engaging
        </text>
        <text transform="translate(280.39 172.71)" fontSize="12px" fontFamily="ArialMT, Arial">
          <tspan>{pEngaging}%</tspan>
        </text>
        {/* <text transform="translate(275.53 194.55)" fontSize="12px" fontFamily="ArialMT, Arial">
          <tspan>n = {engaging < 10 ? `0${engaging}` : engaging}</tspan>
        </text> */}
      </g>
    </svg>
  );
}
