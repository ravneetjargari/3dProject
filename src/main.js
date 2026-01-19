import "./style.css";
import * as THREE from "three";
import gsap from "gsap";
import ScrollTrigger from "gsap/ScrollTrigger";
import Lenis from "@studio-freight/lenis";

import { EffectComposer } from "three/examples/jsm/postprocessing/EffectComposer.js";
import { RenderPass } from "three/examples/jsm/postprocessing/RenderPass.js";
import { UnrealBloomPass } from "three/examples/jsm/postprocessing/UnrealBloomPass.js";
import { ShaderPass } from "three/examples/jsm/postprocessing/ShaderPass.js";

gsap.registerPlugin(ScrollTrigger);

const reduceMotion = window.matchMedia("(prefers-reduced-motion: reduce)").matches;

/* --------------------------------
   Smooth scroll (Lenis)
-------------------------------- */
const lenis = new Lenis({
  duration: 1.25,
  smoothWheel: true,
  smoothTouch: false,
  easing: (t) => 1 - Math.pow(1 - t, 3)
});

function raf(time) {
  lenis.raf(time);
  requestAnimationFrame(raf);
}
requestAnimationFrame(raf);

lenis.on("scroll", ScrollTrigger.update);

/* --------------------------------
   Cursor (premium microinteraction)
-------------------------------- */
const cursor = document.getElementById("cursor");
const cursorLabel = document.getElementById("cursorLabel");

let mx = window.innerWidth / 2;
let my = window.innerHeight / 2;
let cx = mx;
let cy = my;

window.addEventListener("mousemove", (e) => {
  mx = e.clientX;
  my = e.clientY;
}, { passive: true });

function setCursorLabel(text, show = true) {
  if (!cursorLabel) return;
  cursorLabel.textContent = text || "";
  gsap.to(cursorLabel, { opacity: show ? 1 : 0, duration: 0.2, ease: "power2.out" });
}

function cursorTick() {
  // Smooth follow
  cx += (mx - cx) * 0.18;
  cy += (my - cy) * 0.18;
  if (cursor) cursor.style.transform = `translate(${cx}px, ${cy}px)`;
  requestAnimationFrame(cursorTick);
}
if (!reduceMotion) cursorTick();

/* Magnetic hover */
function magnetic(el, strength = 18) {
  if (!el || reduceMotion) return;
  el.addEventListener("mousemove", (e) => {
    const r = el.getBoundingClientRect();
    const x = (e.clientX - r.left) / r.width - 0.5;
    const y = (e.clientY - r.top) / r.height - 0.5;
    gsap.to(el, { x: x * strength, y: y * strength * 0.8, duration: 0.35, ease: "power3.out" });
  });
  el.addEventListener("mouseleave", () => {
    gsap.to(el, { x: 0, y: 0, duration: 0.6, ease: "elastic.out(1, 0.35)" });
  });
}

/* --------------------------------
   Case Study transition (Work → Overlay)
-------------------------------- */
const caseOverlay = document.getElementById("caseOverlay");
const caseTitle = document.getElementById("caseTitle");
const caseDesc = document.getElementById("caseDesc");
const caseClose = document.getElementById("caseClose");

let overlayOpen = false;

function openCase({ title, desc }) {
  if (overlayOpen) return;
  overlayOpen = true;

  caseTitle.textContent = title || "Project";
  caseDesc.textContent = desc || "Placeholder case study.";

  caseOverlay.style.display = "block";
  caseOverlay.setAttribute("aria-hidden", "false");

  // Freeze scrolling
  lenis.stop();

  gsap.fromTo(caseOverlay, { opacity: 0 }, { opacity: 1, duration: 0.35, ease: "power2.out" });
  gsap.fromTo(".case-inner", { y: 16, opacity: 0 }, { y: 0, opacity: 1, duration: 0.55, ease: "power3.out" });
}

function closeCase() {
  if (!overlayOpen) return;
  overlayOpen = false;

  gsap.to(".case-inner", { y: 10, opacity: 0, duration: 0.25, ease: "power2.in" });
  gsap.to(caseOverlay, {
    opacity: 0,
    duration: 0.25,
    ease: "power2.in",
    onComplete: () => {
      caseOverlay.style.display = "none";
      caseOverlay.setAttribute("aria-hidden", "true");
      lenis.start();
    }
  });
}

caseClose?.addEventListener("click", closeCase);
caseOverlay?.addEventListener("click", (e) => {
  if (e.target === caseOverlay || e.target.classList.contains("case-bg")) closeCase();
});
window.addEventListener("keydown", (e) => {
  if (e.key === "Escape") closeCase();
});

document.querySelectorAll(".card").forEach((card) => {
  magnetic(card, 12);
  card.addEventListener("mouseenter", () => setCursorLabel("View", true));
  card.addEventListener("mouseleave", () => setCursorLabel("", false));
  card.addEventListener("click", () => {
    openCase({
      title: card.dataset.case || card.querySelector("h3")?.textContent,
      desc: card.dataset.desc || card.querySelector("p")?.textContent
    });
  });
});

const cta = document.getElementById("cta");
magnetic(cta, 10);
cta?.addEventListener("mouseenter", () => setCursorLabel("Start", true));
cta?.addEventListener("mouseleave", () => setCursorLabel("", false));

/* --------------------------------
   THREE: Scene setup
-------------------------------- */
const canvas = document.getElementById("gl");

const renderer = new THREE.WebGLRenderer({
  canvas,
  antialias: true,
  alpha: true,
  powerPreference: "high-performance"
});
renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
renderer.setSize(window.innerWidth, window.innerHeight, false);

const scene = new THREE.Scene();
scene.fog = new THREE.Fog(new THREE.Color("#07070a"), 7, 28);

const camera = new THREE.PerspectiveCamera(42, window.innerWidth / window.innerHeight, 0.1, 120);
camera.position.set(0, 0.75, 9);

const clock = new THREE.Clock();

/* Lights */
const key = new THREE.DirectionalLight(new THREE.Color("#ffffff"), 1.35);
key.position.set(3, 3, 5);
scene.add(key);

const fill = new THREE.DirectionalLight(new THREE.Color("#8ea0ff"), 0.55);
fill.position.set(-4, 1, 2);
scene.add(fill);

const rim = new THREE.DirectionalLight(new THREE.Color("#ffd1a3"), 0.35);
rim.position.set(-2, 2, -5);
scene.add(rim);

scene.add(new THREE.AmbientLight(new THREE.Color("#6b6b78"), 0.22));

/* Load noise texture for shader */
const texLoader = new THREE.TextureLoader();
const noiseTex = texLoader.load("/textures/noise.png");
noiseTex.wrapS = THREE.RepeatWrapping;
noiseTex.wrapT = THREE.RepeatWrapping;

/* Shader hero material (noise + fresnel + subtle displacement) */
const heroGeo = new THREE.IcosahedronGeometry(1.65, 64);

const heroMat = new THREE.ShaderMaterial({
  uniforms: {
    uTime: { value: 0 },
    uNoise: { value: noiseTex },
    uBase: { value: new THREE.Color("#d7dcff") },
    uGlow: { value: new THREE.Color("#ffffff") },
    uIntensity: { value: 1.0 }
  },
  vertexShader: `
    uniform float uTime;
    uniform sampler2D uNoise;

    varying vec3 vPos;
    varying vec3 vNormal;
    varying vec2 vUv;

    void main(){
      vUv = uv;
      vNormal = normalize(normalMatrix * normal);
      vec3 p = position;

      // Noise-driven displacement
      vec2 nUv = uv * 2.0 + vec2(uTime * 0.03, uTime * 0.02);
      float n = texture2D(uNoise, nUv).r;
      p += normal * (n - 0.5) * 0.25;

      vec4 world = modelMatrix * vec4(p, 1.0);
      vPos = world.xyz;

      gl_Position = projectionMatrix * viewMatrix * world;
    }
  `,
  fragmentShader: `
    uniform float uTime;
    uniform vec3 uBase;
    uniform vec3 uGlow;

    varying vec3 vPos;
    varying vec3 vNormal;
    varying vec2 vUv;

    void main(){
      vec3 N = normalize(vNormal);
      vec3 V = normalize(cameraPosition - vPos);

      // Fresnel for premium rim
      float fres = pow(1.0 - max(dot(N, V), 0.0), 3.0);
      float pulse = 0.5 + 0.5 * sin(uTime * 0.6);

      // Subtle vignette-ish shading via UV
      float vign = smoothstep(0.95, 0.35, distance(vUv, vec2(0.5)));

      vec3 col = uBase;
      col += uGlow * fres * (0.55 + 0.25 * pulse);
      col *= (0.85 + 0.15 * vign);

      float alpha = 0.92;
      gl_FragColor = vec4(col, alpha);
    }
  `,
  transparent: true
});

const hero = new THREE.Mesh(heroGeo, heroMat);
hero.position.set(0, 0.2, 0);
scene.add(hero);

/* Depth particles */
const dots = new THREE.Group();
scene.add(dots);

const dotGeo = new THREE.SphereGeometry(0.055, 18, 18);
const dotMat = new THREE.MeshStandardMaterial({ color: 0xffffff, roughness: 0.35, metalness: 0.0 });

for (let i = 0; i < 260; i++) {
  const m = new THREE.Mesh(dotGeo, dotMat);
  const r = 7 + Math.random() * 14;
  const a = Math.random() * Math.PI * 2;
  const y = (Math.random() - 0.5) * 7;
  m.position.set(Math.cos(a) * r, y, Math.sin(a) * r);
  m.scale.setScalar(0.6 + Math.random() * 1.6);
  dots.add(m);
}

/* Back plate */
const back = new THREE.Mesh(
  new THREE.PlaneGeometry(60, 60),
  new THREE.MeshBasicMaterial({ color: new THREE.Color("#06060b"), transparent: true, opacity: 0.75 })
);
back.position.set(0, 0, -14);
scene.add(back);

/* --------------------------------
   Postprocessing (bloom + vignette + grain)
-------------------------------- */
const composer = new EffectComposer(renderer);
composer.addPass(new RenderPass(scene, camera));

// Subtle bloom (don’t overdo)
const bloom = new UnrealBloomPass(
  new THREE.Vector2(window.innerWidth, window.innerHeight),
  0.35, // strength
  0.7,  // radius
  0.85  // threshold
);
composer.addPass(bloom);

// Vignette + animated grain (uses grain.png)
const grainTex = texLoader.load("/textures/grain.png");
grainTex.wrapS = THREE.RepeatWrapping;
grainTex.wrapT = THREE.RepeatWrapping;

const VignetteGrainPass = new ShaderPass({
  uniforms: {
    tDiffuse: { value: null },
    uTime: { value: 0 },
    uGrain: { value: grainTex },
    uGrainAmount: { value: 0.06 },
    uVignette: { value: 0.35 }
  },
  vertexShader: `
    varying vec2 vUv;
    void main(){
      vUv = uv;
      gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
    }
  `,
  fragmentShader: `
    uniform sampler2D tDiffuse;
    uniform sampler2D uGrain;
    uniform float uTime;
    uniform float uGrainAmount;
    uniform float uVignette;

    varying vec2 vUv;

    void main(){
      vec4 col = texture2D(tDiffuse, vUv);

      // Vignette
      float d = distance(vUv, vec2(0.5));
      float vig = smoothstep(0.85, uVignette, d);
      col.rgb *= (0.82 + 0.18 * vig);

      // Grain (animated offset)
      vec2 gUv = vUv * 1.6 + vec2(uTime * 0.02, uTime * 0.015);
      float g = texture2D(uGrain, gUv).r;
      col.rgb += (g - 0.5) * uGrainAmount;

      gl_FragColor = col;
    }
  `
});
composer.addPass(VignetteGrainPass);

/* --------------------------------
   Preloader
-------------------------------- */
const preloader = document.getElementById("preloader");
const pctEl = document.getElementById("pct");
const barEl = document.getElementById("bar");

function runPreloader() {
  if (reduceMotion) {
    preloader.style.display = "none";
    return Promise.resolve();
  }
  return new Promise((resolve) => {
    const obj = { p: 0 };
    gsap.to(obj, {
      p: 100,
      duration: 1.15,
      ease: "power2.out",
      onUpdate: () => {
        const p = Math.round(obj.p);
        pctEl.textContent = `${p}%`;
        barEl.style.width = `${p}%`;
      },
      onComplete: () => {
        gsap.to(preloader, {
          autoAlpha: 0,
          duration: 0.65,
          ease: "power2.out",
          onComplete: () => {
            preloader.style.display = "none";
            resolve();
          }
        });
      }
    });
  });
}

/* --------------------------------
   Scroll choreography (camera “shots” + pinned chapters)
-------------------------------- */
const state = {
  camX: 0, camY: 0.75, camZ: 9,
  lookX: 0, lookY: 0.2, lookZ: 0,
  keyX: 3, keyY: 3, keyZ: 5,
  rot: 0
};

const shots = [
  // HERO
  { cam: [0.0, 0.75, 9.0], look: [0.0, 0.2, 0.0], key: [3, 3, 5] },
  // WORK
  { cam: [1.35, 0.45, 6.6], look: [0.0, 0.1, 0.0], key: [4.5, 2.2, 3.4] },
  // CH1
  { cam: [-1.25, 0.95, 7.4], look: [0.25, 0.25, 0.0], key: [-3.0, 3.4, 4.4] },
  // CH2
  { cam: [0.75, 1.15, 5.9], look: [0.0, 0.22, 0.0], key: [2.6, 4.0, 2.1] },
  // ABOUT
  { cam: [0.0, 0.62, 9.4], look: [0.0, 0.2, 0.0], key: [3.6, 2.8, 5.6] }
];

function goToShot(i) {
  const s = shots[i] || shots[0];
  const dur = reduceMotion ? 0 : 1.2;
  const ease = reduceMotion ? "none" : "power3.out";

  gsap.to(state, { camX: s.cam[0], camY: s.cam[1], camZ: s.cam[2], duration: dur, ease });
  gsap.to(state, { lookX: s.look[0], lookY: s.look[1], lookZ: s.look[2], duration: dur, ease });
  gsap.to(state, { keyX: s.key[0], keyY: s.key[1], keyZ: s.key[2], duration: dur, ease });
}

function setupScroll() {
  const panels = Array.from(document.querySelectorAll(".panel"));
  panels.forEach((panel) => {
    const idx = Number(panel.dataset.panel || 0);
    ScrollTrigger.create({
      trigger: panel,
      start: "top 60%",
      end: "bottom 40%",
      onEnter: () => goToShot(idx),
      onEnterBack: () => goToShot(idx)
    });
  });

  document.querySelectorAll(".chapter").forEach((el) => {
    ScrollTrigger.create({
      trigger: el,
      start: "top top",
      end: "+=150%",
      pin: true,
      pinSpacing: true
    });
  });

  ScrollTrigger.create({
    trigger: "#app",
    start: "top top",
    end: "bottom bottom",
    scrub: reduceMotion ? false : 0.9,
    onUpdate: (self) => {
      state.rot = self.progress * Math.PI * 2.5;
    }
  });

  setTimeout(() => ScrollTrigger.refresh(), 250);
}

/* --------------------------------
   Resize
-------------------------------- */
function resize() {
  const w = window.innerWidth;
  const h = window.innerHeight;

  renderer.setSize(w, h, false);
  composer.setSize(w, h);

  camera.aspect = w / h;
  camera.updateProjectionMatrix();

  ScrollTrigger.refresh();
}
window.addEventListener("resize", resize, { passive: true });

/* --------------------------------
   Render loop
-------------------------------- */
function tick() {
  const t = clock.getElapsedTime();

  heroMat.uniforms.uTime.value = t;
  VignetteGrainPass.uniforms.uTime.value = t;

  // Cinematic motion
  hero.rotation.y = state.rot + t * 0.08;
  hero.rotation.x = Math.sin(t * 0.35) * 0.12;

  dots.rotation.y = t * 0.03;
  dots.rotation.x = Math.sin(t * 0.12) * 0.02;

  // Camera + look
  camera.position.set(state.camX, state.camY, state.camZ);
  camera.lookAt(state.lookX, state.lookY, state.lookZ);

  // Lights
  key.position.set(state.keyX, state.keyY, state.keyZ);
  fill.position.x = -4 + Math.sin(t * 0.35) * 0.7;
  rim.position.z = -5 + Math.cos(t * 0.28) * 0.7;

  composer.render();
  requestAnimationFrame(tick);
}

/* --------------------------------
   Boot
-------------------------------- */
(async function init() {
  await runPreloader();
  resize();
  setupScroll();
  goToShot(0);
  tick();
})();
