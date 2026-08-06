import * as THREE from "three";

const container = document.getElementById("gallery-hero-webgl");

if (!container) {
    console.error("gallery-hero-webgl container not found.");
} else {

    //---------------------------------------
    // Scene
    //---------------------------------------

    const scene = new THREE.Scene();

    //---------------------------------------
    // Camera
    //---------------------------------------

    const camera = new THREE.OrthographicCamera(
        -1,
         1,
         1,
        -1,
         0,
         1
    );

    //---------------------------------------
    // Renderer
    //---------------------------------------

    const renderer = new THREE.WebGLRenderer({
        antialias: true,
        alpha: true
    });

    renderer.setPixelRatio(window.devicePixelRatio);

    renderer.setSize(
        container.clientWidth,
        container.clientHeight
    );

    container.appendChild(renderer.domElement);

    //---------------------------------------
    // Texture Loader
    //---------------------------------------

    const loader = new THREE.TextureLoader();

    let colorTexture = null;
    let depthTexture = null;
    let material = null;

    function tryBuild() {
        if (!colorTexture || !depthTexture) return;

        colorTexture.minFilter = THREE.LinearFilter;
        depthTexture.minFilter = THREE.LinearFilter;

        const geometry = new THREE.PlaneGeometry(2, 2);

        material = new THREE.ShaderMaterial({
            uniforms: {
                uColor: { value: colorTexture },
                uDepth: { value: depthTexture },
                uMouse: { value: new THREE.Vector2(0, 0) },
                uStrength: { value: 0.02 },
                uDepthBlur: { value: 0.003 },
                uImageAspect: { value: colorTexture.image.width / colorTexture.image.height },
                uScreenAspect: { value: container.clientWidth / container.clientHeight },
            },
            vertexShader: `
                varying vec2 vUv;
                void main() {
                    vUv = uv;
                    vec3 scaled = position * 1.08;   /* zoom in 8% — hides edge bleed */
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
                    // Cover mode: scale UV to fill height, clip width
                    vec2 uv = vUv;
                    float ratio = uScreenAspect / uImageAspect;
                    if (ratio > 1.0) {
                        // screen is wider than image — clip top/bottom
                        uv.y = uv.y / ratio + (1.0 - 1.0 / ratio) * 0.5;
                    } else {
                        // screen is taller than image (mobile) — clip left/right
                        uv.x = uv.x * ratio + (1.0 - ratio) * 0.85;
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

        const mesh = new THREE.Mesh(geometry, material);
        scene.add(mesh);

        const mouse = { x: 0, y: 0 };
        const current = { x: 0, y: 0 };

        const isTouch = ('ontouchstart' in window) || window.matchMedia('(pointer: coarse)').matches;

        if (!isTouch) {
            window.addEventListener("mousemove", (e) => {
                mouse.x =  (e.clientX / window.innerWidth  - 0.5) * 2;
                mouse.y = -(e.clientY / window.innerHeight - 0.5) * 2;
            });
        }

        const t0 = performance.now();

        function animate() {
            requestAnimationFrame(animate);
            if (isTouch) {
                const t = (performance.now() - t0) / 1000;
                const drift = Math.min(1, t / 1.5);
                mouse.x = (Math.sin(t * 0.7) * 0.5 + Math.sin(t * 1.7) * 0.2) * drift;
                mouse.y = (Math.sin(t * 0.5) * 0.5 + Math.sin(t * 1.3) * 0.2) * drift;
            }
            current.x += (mouse.x - current.x) * 0.04;
            current.y += (mouse.y - current.y) * 0.04;
            material.uniforms.uMouse.value.set(current.x, current.y);
            renderer.render(scene, camera);
        }

        animate();
    }

    loader.load("assets/images/galleryhero.webp",
        (t) => { colorTexture = t; tryBuild(); },
        undefined,
        (e) => console.error("Color load failed:", e)
    );

    loader.load("assets/images/galleryhero-depth.png",
        (t) => { depthTexture = t; tryBuild(); },
        undefined,
        (e) => console.error("Depth load failed:", e)
    );

    window.addEventListener("resize",()=>{

        renderer.setSize(

            container.clientWidth,

            container.clientHeight

        );

        if (material) material.uniforms.uScreenAspect.value = container.clientWidth / container.clientHeight;

    });

}
