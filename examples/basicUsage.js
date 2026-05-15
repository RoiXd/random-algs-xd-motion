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
  const fx = x => Math.sin(x)*Math.cos(2*x)

  const anim = fn2Animation(object, fx,
    [-4, 4], 60, 3, {
      easing: "linear",
      tracePath: true,
      traceStyle: {
        stroke: "orangered",
        strokeWidth: "0.2px",
        strokeDasharray: "3px 2px"
      }
    })

  console.log(anim)
  anim.play()
}

animateBtn.addEventListener('click', animateObj)

