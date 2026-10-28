// Original window-and-desk artwork from the approved homepage draft.
export default function WindowIllustration() {
  return (
    <svg className="hero-illustration" viewBox="0 0 500 310" fill="none" aria-hidden="true" focusable="false">
      <defs>
        <linearGradient id="window-light" x1="230" y1="75" x2="355" y2="290" gradientUnits="userSpaceOnUse"><stop stopColor="#efdfb4" stopOpacity=".48" /><stop offset="1" stopColor="#efdfb4" stopOpacity="0" /></linearGradient>
        <linearGradient id="vase-shade" x1="386" y1="203" x2="434" y2="267" gradientUnits="userSpaceOnUse"><stop stopColor="#e2d5bb" /><stop offset="1" stopColor="#c6b697" /></linearGradient>
        <linearGradient id="mug-shade" x1="277" y1="211" x2="324" y2="264" gradientUnits="userSpaceOnUse"><stop stopColor="#b5c0a4" /><stop offset="1" stopColor="#8e9f7f" /></linearGradient>
        <clipPath id="window-clip"><path d="M212 185V79a63 63 0 0 1 126 0v106Z" /></clipPath>
      </defs>
      <ellipse cx="278" cy="276" rx="204" ry="15" fill="#758167" opacity=".06" />
      <g className="art-room">
        <path d="M203 192V78a72 72 0 0 1 144 0v114Z" fill="#d7c9ac" opacity=".52" /><path d="M211 186V79a64 64 0 0 1 128 0v107Z" className="art-sky" />
        <g clipPath="url(#window-clip)">
          <circle cx="303" cy="65" r="22" className="art-sun" />
          <path d="M193 157c31-30 50-15 74-25 26-12 50-27 87-2v66H193Z" fill="#b4bfa0" opacity=".65" /><path d="M205 169c34-23 48-8 74-17 29-11 43-13 66-8v49H205Z" fill="#91a284" opacity=".6" />
          <path d="M319 185V122m0 20-12-10m12-2 9-11m-9 36 12-11" stroke="#819575" strokeWidth="1.5" />
          <g className="art-night-stars" fill="#f3e6bf"><circle cx="234" cy="65" r="1.5" /><circle cx="278" cy="30" r="1.2" /><circle cx="246" cy="97" r="1.3" /><circle cx="323" cy="104" r="1.5" /></g>
        </g>
        <path d="M275 16v169M212 111h126" stroke="#e2d7be" strokeWidth="6" /><path d="M205 190h142" stroke="#c7b898" strokeWidth="5" strokeLinecap="round" />
        <path d="m216 193-88 85h249l-41-85Z" fill="url(#window-light)" /><path d="m266 195-23 81M293 195l6 81" stroke="#ddd0ae" opacity=".25" strokeWidth="4" />
        <path d="M188 34c-5 56-2 112-15 171l27-10c9-58 5-106 10-156Z" fill="#ece5d6" opacity=".8" /><path d="M354 36c8 63 3 105 16 170l-26-12c-8-52-6-105-10-155Z" fill="#e9e1d0" opacity=".65" />
      </g>
      <path d="M102 267c80-11 254-17 343-2l22 14c-91 10-293 9-388 1Z" className="art-wood" />
      <g transform="rotate(-7 172 246)">
        <rect x="102" y="227" width="139" height="40" rx="3" fill="#859775" /><path d="M106 233h131v28H106Z" fill="#efe8d5" /><path d="M109 239h123M109 245h123M109 251h123M109 257h123" stroke="#d5ccb7" strokeWidth=".7" />
        <rect x="99" y="225" width="142" height="9" rx="2" fill="#a4b18f" /><path d="M111 226v7" stroke="#7a8e6a" /><path d="m173 234 11 25 2-13 10 6-11-18" fill="#b79d70" />
        <rect x="115" y="218" width="115" height="8" rx="2" fill="#d4b78a" /><rect x="119" y="219" width="107" height="5" fill="#f4edda" /><path d="M114 217h117" stroke="#bba075" strokeWidth="3" strokeLinecap="round" />
      </g>
      <g>
        <ellipse cx="300" cy="264" rx="42" ry="7" fill="#a5a082" opacity=".21" /><path d="M320 224c26-5 26 28 2 26" stroke="#8d9d7c" strokeWidth="7" /><path d="M274 220h50l-4 34c-1 13-41 13-43 0Z" fill="url(#mug-shade)" />
        <ellipse cx="299" cy="220" rx="25" ry="7" fill="#bfcaac" /><ellipse cx="299" cy="220" rx="19" ry="4" fill="#89744f" /><path d="M286 228v20" stroke="#dbe0ca" strokeOpacity=".4" strokeWidth="2" strokeLinecap="round" />
        <path d="M292 202c-8-12 8-14 1-26M305 200c-7-11 7-14 2-24" stroke="#a4ab95" strokeWidth="1.3" strokeLinecap="round" opacity=".5" />
      </g>
      <g>
        <path d="M387 218c-6 16-8 32-3 43 5 12 43 12 49 0 5-11 3-27-3-43Z" fill="url(#vase-shade)" /><ellipse cx="409" cy="218" rx="22" ry="5" fill="#c7b99d" /><ellipse cx="409" cy="217" rx="14" ry="2.7" fill="#a79e82" />
        <path d="M409 218c-6-37-15-65-26-93M412 216c7-38 24-62 28-94M408 194c-21-23-44-36-58-59M417 190c15-13 32-18 44-32M403 176c2-27 1-41-5-60" stroke="#7a8b68" strokeWidth="1.7" strokeLinecap="round" />
        <path d="M387 141c-19 2-30-8-28-22 18 0 29 6 28 22Z" fill="#8f9f7a" /><path d="M381 126c-4-15 0-29 14-33 7 16 2 27-14 33Z" fill="#a8b28f" /><path d="M398 157c-18 1-24-7-25-19 17-1 27 6 25 19Z" fill="#a5b18d" /><path d="M402 135c-1-17 5-27 18-29 4 16-3 26-18 29Z" fill="#7f946d" />
        <path d="M430 157c-2-18 5-29 21-30 1 16-5 25-21 30Z" fill="#9aa982" /><path d="M439 133c-8-15-4-29 7-37 10 15 7 28-7 37Z" fill="#7f946d" /><path d="M441 168c7-15 19-19 31-12-6 15-17 20-31 12Z" fill="#adb695" /><path d="M369 158c-17 3-28-6-29-19 17-1 28 5 29 19Z" fill="#b1ba9b" />
        <path d="M383 174c-15 2-23-4-25-16 15-2 25 4 25 16Z" fill="#8fa17e" /><path d="M406 187c-15-6-18-16-12-29 15 7 19 18 12 29Z" fill="#96a680" /><path d="M421 187c8-12 21-14 31-6-7 12-20 16-31 6Z" fill="#7e946b" />
      </g>
      <path d="M66 274c15-4 23-2 34 0M70 278c8-1 17-1 24 0" stroke="#b5b99f" strokeWidth="1.2" strokeLinecap="round" opacity=".6" />
    </svg>
  );
}
