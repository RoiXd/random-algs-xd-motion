import { fn2Animation } from "./animate.ts";

const animateBtn = document.getElementById("animate-btn")

const object = document.getElementById("animation-obj")

function animateObj() {
  const fx = x => x**3

  const anim = fn2Animation(object, fx,
    [-3, 3], 60, 3, {
      easing: "linear",
      tracePath: true,
      trailStyle: {
        stroke: "orangered",
        strokeWidth: "0.2px"
      }
    })

  console.log(anim)
  anim.play()
}

animateBtn.addEventListener('click', animateObj)

