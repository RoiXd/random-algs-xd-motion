import type { Getter } from "./types.ts"
/** This is a comment. */
export class Derivative {
    f: Getter<number>;
    x: Getter<number>;
    private x_history: number[] = [];
    private f_history: number[] = [];
    
    constructor(f: Getter<number>, x: Getter<number>) {
        this.f = f;
        this.x = x;
        this.x_history.push(x());
        this.f_history.push(f());
    }
    
    // Recursive method that updates and returns all derivatives
    calcNext(maxOrder: number = 3): Map<number, number> {
        // Add new data point
        this.x_history.push(this.x());
        this.f_history.push(this.f());
        
        // Trim history if needed
        if (this.x_history.length > maxOrder + 10) {
            this.x_history.shift();
            this.f_history.shift();
        }
        
        // Recursively compute derivatives
        const derivatives = new Map<number, number>();
        
        const computeDerivative = (order: number, startIdx: number, endIdx: number): number => {

            if (order === 0) {
                return this.f_history.at(endIdx) ?? 0;
            }
            
            if (endIdx - startIdx < order) {
                return 0;
            }
            
            // Recursive call for lower order derivatives
            const leftDeriv = computeDerivative(order - 1, startIdx, endIdx - 1);
            const rightDeriv = computeDerivative(order - 1, startIdx + 1, endIdx);
            
            const x_left = this.x_history[endIdx - 1];
            const x_right = this.x_history[endIdx];

            if(!x_left || !x_right) throw new TypeError("Wrong derivative index")
            
            return (rightDeriv - leftDeriv) / (x_right - x_left);
        };
        
        // Calculate derivatives from 1 to maxOrder recursively
        const calculateAll = (currentOrder: number): void => {
            if (currentOrder > maxOrder) return;
            
            const lastIdx = this.x_history.length - 1;
            const deriv = computeDerivative(
                currentOrder, 
                0, 
                lastIdx
            );
            derivatives.set(currentOrder, deriv);
            calculateAll(currentOrder + 1);
        };
        
        calculateAll(1);
        return derivatives;
    }
    
    // Simple recursive method for just the next derivative
    calcNextDerivative(order: number = 1): number {
        if (order === 0) {
            return this.f();
        }
        
        // Add new point if needed (call this before recursion)
        const needsUpdate = this.x_history[this.x_history.length - 1] !== this.x();
        if (needsUpdate) {
            this.x_history.push(this.x());
            this.f_history.push(this.f());
        }
        
        const n = this.x_history.length;
        if (n < order + 1) return 0;
        
        // Recursive definition of derivative
        const leftDeriv = this.calcNextDerivativeRecursive(order - 1, 0, n - 2);
        const rightDeriv = this.calcNextDerivativeRecursive(order - 1, 1, n - 1);
        
        return (rightDeriv - leftDeriv) / (this.x_history[n-1]! - this.x_history[n-2]!);
    }
    
    private calcNextDerivativeRecursive(order: number, start: number, end: number): number {
        if (order === 0) {
            return this.f_history[end] ?? 0;
        }
        
        if (end - start < order) {
            return 0;
        }
        
        const leftDeriv = this.calcNextDerivativeRecursive(order - 1, start, end - 1);
        const rightDeriv = this.calcNextDerivativeRecursive(order - 1, start + 1, end);
        
        return (rightDeriv - leftDeriv) / (this.x_history[end]! - this.x_history[start]!);
    }
}