import * as THREE from "three";

/* ==========================================================
   HERO DEPTH / PARALLAX EFFECT
========================================================== */

const heroContainer = document.getElementById("services-hero-webgl");

if (!heroContainer) {
    console.error("services-hero-webgl container not found.");
} else {

    const heroScene = new THREE.Scene();
    const heroCamera = new THREE.OrthographicCamera(-1, 1, 1, -1, 0, 1);

    const heroRenderer = new THREE.WebGLRenderer({ antialias: true, alpha: true });
    heroRenderer.setPixelRatio(window.devicePixelRatio);
    heroRenderer.setSize(heroContainer.clientWidth, heroContainer.clientHeight);
    heroContainer.appendChild(heroRenderer.domElement);

    const texLoader = new THREE.TextureLoader();
    let colorTexture = null;
    let depthTexture = null;
    let heroMaterial = null;

    function tryBuild() {
        if (!colorTexture || !depthTexture) return;

        colorTexture.minFilter = THREE.LinearFilter;
        depthTexture.minFilter = THREE.LinearFilter;

        const geometry = new THREE.PlaneGeometry(2, 2);

        heroMaterial = new THREE.ShaderMaterial({
            uniforms: {
                uColor:        { value: colorTexture },
                uDepth:        { value: depthTexture },
                uMouse:        { value: new THREE.Vector2(0, 0) },
                uStrength:     { value: 0.02 },
                uDepthBlur:    { value: 0.003 },
                uImageAspect:  { value: colorTexture.image.width / colorTexture.image.height },
                uScreenAspect: { value: heroContainer.clientWidth / heroContainer.clientHeight },
            },
            vertexShader: `
                varying vec2 vUv;
                void main() {
                    vUv = uv;
                    vec3 scaled = position * 1.08;
                    gl_Position = vec4(scaled, 1.0);
                }
            `,
            fragmentShader: `
                uniform sampler2D uColor;
                uniform sampler2D uDepth;
                uniform vec2 uMouse;
                uniform float uStrength;
                uniform float uImageAspect;
                uniform float uScreenAspect;
                varying vec2 vUv;

                void main() {
                    vec2 uv = vUv;
                    float ratio = uScreenAspect / uImageAspect;
                    if (ratio > 1.0) {
                        uv.y = uv.y / ratio + (1.0 - 1.0 / ratio) * 0.5;
                    } else {
                        uv.x = uv.x * ratio + (1.0 - ratio) * 0.8;
                    }

                    float d0 = texture2D(uDepth, uv).r;
                    float d1 = texture2D(uDepth, uv + vec2(0.003, 0.0)).r;
                    float d2 = texture2D(uDepth, uv - vec2(0.003, 0.0)).r;
                    float d3 = texture2D(uDepth, uv + vec2(0.0, 0.003)).r;
                    float d4 = texture2D(uDepth, uv - vec2(0.0, 0.003)).r;
                    float depth = (d0 + d1 + d2 + d3 + d4) / 5.0;

                    vec2 offset = uMouse * depth * uStrength;
                    vec2 displaced = clamp(uv + offset, 0.001, 0.999);
                    gl_FragColor = texture2D(uColor, displaced);
                }
            `,
        });

        const mesh = new THREE.Mesh(geometry, heroMaterial);
        heroScene.add(mesh);

        const mouse   = { x: 0, y: 0 };
        const current = { x: 0, y: 0 };

        const isTouch = ('ontouchstart' in window) || window.matchMedia('(pointer: coarse)').matches;

        if (!isTouch) {
            window.addEventListener("mousemove", (e) => {
                mouse.x =  (e.clientX / window.innerWidth  - 0.5) * 2;
                mouse.y = -(e.clientY / window.innerHeight - 0.5) * 2;
            });
        }

        const t0 = performance.now();

        function animateHero() {
            requestAnimationFrame(animateHero);
            if (isTouch) {
                const t = (performance.now() - t0) / 1000;
                const drift = Math.min(1, t / 1.5);
                mouse.x = (Math.sin(t * 0.7) * 0.5 + Math.sin(t * 1.7) * 0.2) * drift;
                mouse.y = (Math.sin(t * 0.5) * 0.5 + Math.sin(t * 1.3) * 0.2) * drift;
            }
            current.x += (mouse.x - current.x) * 0.04;
            current.y += (mouse.y - current.y) * 0.04;
            heroMaterial.uniforms.uMouse.value.set(current.x, current.y);
            heroRenderer.render(heroScene, heroCamera);
        }

        animateHero();
    }

    texLoader.load(
        "assets/images/serviceshero.webp",
        (t) => { colorTexture = t; tryBuild(); },
        undefined,
        (e) => console.error("Color texture load failed:", e)
    );

    texLoader.load(
        "assets/images/serviceshero-depth.png",
        (t) => { depthTexture = t; tryBuild(); },
        undefined,
        (e) => console.error("Depth texture load failed:", e)
    );

    window.addEventListener("resize", () => {
        heroRenderer.setSize(heroContainer.clientWidth, heroContainer.clientHeight);
        if (heroMaterial) {
            heroMaterial.uniforms.uScreenAspect.value =
                heroContainer.clientWidth / heroContainer.clientHeight;
        }
    });
}