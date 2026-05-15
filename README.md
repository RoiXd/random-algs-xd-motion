# Simple algorithms for displaying animations
This repository contains a simple set of functions to animate an object through a parent element, 
including based on a graph of a mathematic function or a svg path.
## Animate an object based off a function with fn2Animation()
The function `fn2Animation` takes as input: 
* The object to animate (must be a child of an element that has a size)
* The mathematical function that produces the animation graph
* Other parameters such as duration, fps, tracing, styling and more !

And returns a Web API [`Animation`](https://developer.mozilla.org/en-US/docs/Web/API/Animation) 
object, which can be played, played in reverse, played in a loop...
## Decorate animations with a variety of effects
