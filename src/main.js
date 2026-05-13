import { fn2Animation } from "./animate";

const animateBtn = document.getElementById("animate-btn")

const object = document.getElementById("animation-obj")

function animateObj() {
  const anim = fn2Animation(object, x => -5*Math.sin(x), [-20, 20], 40, 4)

  console.log(anim)
  anim.play()
}

animateBtn.addEventListener('click', animateObj)