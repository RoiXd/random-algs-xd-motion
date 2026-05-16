import { fn2Animation } from "../src/core/animate.ts";

// Document shape
const app = document.createElement("div")
app.id = "app"

app.innerHTML = `
      <div class="animation-wrapper">
        <div id="animation-container">
          <div class="object" id="animation-obj"></div>
        </div>
      </div>
      <button class="btn-primary" id="animate-btn">Animate</button>`

document.body.appendChild(app)

const styleEl = document.createElement("link") 

styleEl.rel = "stylesheet"
styleEl.type = "text/css"
styleEl.href = "examples/basicUsage.css"

document.head.appendChild(styleEl)

const animateBtn = document.getElementById("animate-btn")

const object = document.getElementById("animation-obj")

function animateObj() {
  const fx = x => Math.sin(2*x)*Math.cos(5*x)

  const anim = fn2Animation(object, fx,
    [-2, 2], 50, 5, {
      easing: "linear",
      tracePath: true,
      traceStyle: {
        stroke: "magenta",
        strokeOpacity: "0.5",
        strokeWidth: "0.25px",
        strokeDasharray: "2px 2px"
      },
      enableTrail: true,
      trailStyle: {
        maxLength: 50,
        decay: 0.08,
        opacityGradient: (p) => 1-p,
        lineWidthGradient: (p) => 50*(1 - p**(2/3)),
        hueGradient: (p) => 30 + + 40*p**3 + 120*p**2,
        lightnessGradient: (p) => 80,
        saturationGradient: (p) => 100
      }
    })


  anim.play()
}

animateBtn.addEventListener('click', animateObj)

