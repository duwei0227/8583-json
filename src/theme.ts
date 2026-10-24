import { definePreset } from '@primeuix/themes'
import Aura from '@primeuix/themes/aura'

// Aura 默认主色是绿色，改为原型使用的蓝色（#1F6FEB 附近的 blue 色阶）
const shades = [50, 100, 200, 300, 400, 500, 600, 700, 800, 900, 950] as const

export const AppPreset = definePreset(Aura, {
  semantic: {
    primary: Object.fromEntries(shades.map((s) => [s, `{blue.${s}}`])),
  },
})
