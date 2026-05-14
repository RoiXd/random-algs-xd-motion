import { fn2Animation } from "./animate.ts";

const animateBtn = document.getElementById("animate-btn")

const object = document.getElementById("animation-obj")

function animateObj() {
  const fx = x => Math.sin(x)*Math.cos(2*x)

  const anim = fn2Animation(object, fx,
    [-4, 4], 60, 3, {
      easing: "linear",
      tracePath: true,
      trailStyle: {
        stroke: "orangered",
        strokeWidth: "0.2px",
        strokeDasharray: "3px 2px"
      }
    })

  console.log(anim)
  anim.play()
}

animateBtn.addEventListener('click', animateObj)

