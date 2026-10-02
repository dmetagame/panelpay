import React from "react";
import {
  AbsoluteFill,
  Audio,
  Composition,
  Img,
  Sequence,
  staticFile,
  useCurrentFrame,
  interpolate,
} from "remotion";
import scenes from "./timeline.json";
import screens from "../public/screens/manifest.json";
const fps = 30;
function Scene({
  scene,
  index,
}: {
  scene: (typeof scenes)[number];
  index: number;
}) {
  const frame = useCurrentFrame();
  const time = frame / fps;
  const caption = scene.captions.find((c) => time >= c.start && time < c.end);
  const opacity = interpolate(
    frame,
    [0, 9, scene.frames - 9, scene.frames],
    [0, 1, 1, 0],
    { extrapolateLeft: "clamp", extrapolateRight: "clamp" },
  );
  return (
    <AbsoluteFill
      style={{
        background: "#183d47",
        color: "#f1f5f4",
        fontFamily: "Plex,Arial,sans-serif",
        padding: "48px 72px",
      }}
    >
      <style>{`@font-face{font-family:Plex;src:url('${staticFile("fonts/plex-sans.woff2")}')}`}</style>
      <div
        style={{
          display: "flex",
          justifyContent: "space-between",
          alignItems: "center",
          fontSize: 22,
        }}
      >
        <span style={{ fontWeight: 600 }}>
          panelpay <span style={{ color: "#e45b32" }}>↗</span>
        </span>
        <span style={{ fontSize: 16, color: "#bed0d2" }}>
          ARC TESTNET · INTERNAL REVIEWER FIXTURES
        </span>
      </div>
      <div
        style={{
          display: "flex",
          justifyContent: "space-between",
          alignItems: "baseline",
          marginTop: 25,
          marginBottom: 25,
        }}
      >
        <h1
          style={{
            fontSize: 43,
            fontWeight: 400,
            letterSpacing: -1,
            margin: 0,
          }}
        >
          {scene.title}
        </h1>
        <span style={{ fontSize: 18, color: "#bed0d2" }}>
          {String(index + 1).padStart(2, "0")} / 07
        </span>
      </div>
      <div
        style={{
          height: 730,
          overflow: "hidden",
          border: "1px solid #738f95",
          borderRadius: 10,
          background: "#f1f5f4",
          opacity,
        }}
      >
        <div
          style={{
            height: 34,
            background: "#e5eceb",
            display: "flex",
            alignItems: "center",
            padding: "0 18px",
            gap: 7,
          }}
        >
          {["#a8bcbf", "#a8bcbf", "#a8bcbf"].map((c, i) => (
            <span
              key={i}
              style={{
                height: 7,
                width: 7,
                borderRadius: "50%",
                background: c,
              }}
            />
          ))}
          <span style={{ fontSize: 12, color: "#526970", marginLeft: 18 }}>
            panelpay-ruby.vercel.app · test USDC, no cash value
          </span>
        </div>
        <Img
          src={staticFile("screens/" + scene.screen + ".png")}
          style={{
            width: "100%",
            height: 'auto',
            transform: scene.id === 'receipt' ? `translateY(${interpolate(frame,[90,scene.frames-90],[0,-Math.max(0,screens['08-receipt'].height*1776/1440-696)],{extrapolateLeft:'clamp',extrapolateRight:'clamp'})}px)` : undefined,
            background: "#f1f5f4",
          }}
        />
      </div>
      {index === 6 && (
        <div
          style={{
            position: "absolute",
            left: 100,
            top: 390,
            right: 100,
            background: "#183d47f5",
            padding: 70,
            textAlign: "center",
            border: "1px solid #8fa8ad",
          }}
        >
          <p style={{ fontSize: 48, margin: 0 }}>panelpay-ruby.vercel.app</p>
          <p style={{ fontSize: 30, color: "#bed0d2" }}>
            github.com/dmetagame/panelpay
          </p>
          <p style={{ fontSize: 22, color: "#bed0d2" }}>
            Independent traction: 0 · Internal proof is labeled
          </p>
        </div>
      )}
      <div
        style={{
          height: 70,
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          textAlign: "center",
          fontSize: 26,
          lineHeight: 1.35,
          color: "#fff",
          marginTop: 14,
        }}
      >
        {caption?.text || " "}
      </div>
      <Sequence from={11}>
        <Audio
          src={staticFile("voice/" + scene.id + ".mp3")}
          startFrom={0}
          volume={1}
        />
      </Sequence>
    </AbsoluteFill>
  );
}
function Video() {
  let from = 0;
  return (
    <AbsoluteFill>
      {scenes.map((scene, index) => {
        const start = from;
        from += scene.frames;
        return (
          <Sequence key={scene.id} from={start} durationInFrames={scene.frames}>
            <Scene scene={scene} index={index} />
          </Sequence>
        );
      })}
    </AbsoluteFill>
  );
}
export function Root() {
  return (
    <Composition
      id="PanelPayDemo"
      component={Video}
      durationInFrames={scenes.reduce((n, s) => n + s.frames, 0)}
      fps={fps}
      width={1920}
      height={1080}
    />
  );
}
