// Регрессионный тест: рендер текста на канвасе (Фаза 5).
//
// БАГ (регресс «нет форматирования + сломан перенос»): в getTextLineStyle()
// LabelCanvas.vue значения left/top/width были строками БЕЗ единиц ("12.34").
// Vue 3 НЕ добавляет px автоматически (ни для строк, ни для чисел) — браузер
// отбрасывает такие декларации как невалидные, и все строки текста схлопываются
// в левый верхний угол: теряются перенос, выравнивание и вертикаль.
//
// Тест монтирует РЕАЛЬНЫЙ LabelCanvas с замоканным стором и проверяет, что
// строки текста получают корректные px-единицы, шрифт/жирность и разные top.
//
// ВАЖНО: globals:true — НЕ импортировать describe/it/expect из 'vitest'
// (см. комментарий в textLayout.test.ts).

import { ref, reactive } from 'vue'
import { mount } from '@vue/test-utils'
import LabelCanvas from '@/components/label-editor/LabelCanvas.vue'

// ── Холдер мока стора (vi.mock хойстится выше импортов) ─────────────────────
const storeHolder = vi.hoisted(() => ({ value: null as any }))

vi.mock('@neutralinojs/lib', () => ({
  filesystem: {
    readBinaryFile: vi.fn(() => Promise.reject(new Error('mock: шрифт не найден'))),
    readFile: vi.fn(() => Promise.reject(new Error('mock: нет БД'))),
    createDirectory: vi.fn(() => Promise.resolve())
  },
  computer: {},
  os: {}
}))

vi.mock('@/assets/fontManager', () => ({
  fontManager: { getPathByFullName: vi.fn(() => undefined) }
}))

vi.mock('@/stores/labelEditor', () => ({
  useLabelEditorStore: () => storeHolder.value
}))

function buildStore(zoomValue = 1, rotation: 0 | 90 | 180 | 270 = 0) {
  const textElement = {
    id: 't1',
    type: 'text',
    dataField: 'TEXT_FIELD',
    props: {
      customText: 'AA BB CC DD EE FF GG HH II JJ KK LL MM NN OO PP QQ RR SS TT',
      fontSize: 16,
      fontFamily: 'Arial',
      bold: true,
      align: 'center',
      verticalAlign: 'middle',
      lineHeight: 1.2,
      paddingTop: 0,
      paddingRight: 0,
      paddingBottom: 0,
      paddingLeft: 0,
      textRotation: rotation
    }
  }
  // Состояние — ref'ы внутри reactive: storeToRefs(pinia) включает только
  // isRef/isReactive-свойства и читает их через reactive-прокси (разворачивает ref).
  const store = reactive({
    positions: ref({ t1: { x: 5, y: 5, w: 30, h: 40 } }),
    elements: ref({ t1: textElement }),
    selectedId: ref<string | null>(null),
    selectedIds: ref<string[]>([]),
    labelSizeInPx: ref({ width: 320, height: 200 }),
    labelSizeMM: ref({ width: 80, height: 50 }),
    zoom: ref(zoomValue),
    templateKey: ref('tpl-test'),
    fitZoomTrigger: ref(0),
    copyBrushActive: ref(false),
    linkBrushActive: ref(false),
    showElementBorders: ref(false),
    labelBorder: ref({ enabled: false, width: 1.0, color: '#000000' }),
    // Методы (используются компонентом напрямую)
    getDisplayText: (e: any) => e?.props?.customText ?? e?.dataField ?? '',
    updatePosition: () => {},
    selectCell: () => {},
    applyCopyBrush: () => {},
    applyLinkBrush: () => {},
    deactivateCopyBrush: () => {},
    deactivateLinkBrush: () => {},
    clearMultiSelection: () => {},
    copySelectedContent: () => {},
    cutSelectedContent: () => {},
    pasteToSelected: () => {},
    deleteSelectedContent: () => {},
    removeElement: () => {},
    updateTableProps: () => {}
  })
  return store
}

describe('LabelCanvas: рендер текста (регресс «нет форматирования / сломан перенос»)', () => {
  it('строки текста имеют px-единицы, шрифт/жирность и разные top (перенос)', async () => {
    storeHolder.value = buildStore()
    const wrapper = mount(LabelCanvas, {
      global: {
        stubs: {
          VueDraggableResizable: { template: '<div class="vdr-stub"><slot /></div>' },
          'v-icon': true
        }
      }
    })
    await wrapper.vm.$nextTick()
    // Дожидаемся асинхронной загрузки провайдеров (loadFont → fallback)
    await new Promise((r) => setTimeout(r, 0))
    await wrapper.vm.$nextTick()

    // Строки текста — div с white-space: pre внутри листа этикетки
    const lineEls = wrapper
      .findAll('.canvas-label div')
      .filter((d) => (d.element as HTMLElement).style.whiteSpace === 'pre')

    // Перенос: длинный текст в узком блоке → несколько строк
    expect(lineEls.length).toBeGreaterThan(1)

    for (const line of lineEls) {
      const style = (line.element as HTMLElement).style
      // КЛЮЧЕВОЙ регресс-ассерт: без фикса left/top/width были ПУСТЫМИ (без px)
      expect(style.left).toMatch(/^-?[\d.]+px$/)
      expect(style.top).toMatch(/^-?[\d.]+px$/)
      expect(style.width).toMatch(/^-?[\d.]+px$/)
      // Форматирование строки применяется
      expect(style.fontSize).toBe('16px')
      expect(style.fontWeight).toBe('bold')
      expect(style.fontFamily).toContain('Arial')
    }

    // Разные top у строк → перенос работает, строки не схлопываются в одну точку
    const tops = lineEls.map((d) => parseFloat((d.element as HTMLElement).style.top))
    expect(new Set(tops).size).toBeGreaterThan(1)
  })

  it('строка центрируется по align center (left учитывает ширину строки)', async () => {
    storeHolder.value = buildStore()
    const wrapper = mount(LabelCanvas, {
      global: {
        stubs: {
          VueDraggableResizable: { template: '<div class="vdr-stub"><slot /></div>' },
          'v-icon': true
        }
      }
    })
    await wrapper.vm.$nextTick()
    await new Promise((r) => setTimeout(r, 0))
    await wrapper.vm.$nextTick()

    const lineEls = wrapper
      .findAll('.canvas-label div')
      .filter((d) => (d.element as HTMLElement).style.whiteSpace === 'pre')

    expect(lineEls.length).toBeGreaterThan(0)
    const firstLeft = parseFloat((lineEls[0].element as HTMLElement).style.left)
    const firstWidth = parseFloat((lineEls[0].element as HTMLElement).style.width)
    // align:center → left > 0 (строка не прижата к левому краю блока)
    expect(firstLeft).toBeGreaterThan(0)
    expect(firstWidth).toBeGreaterThan(0)
  })

  it('размер шрифта масштабируется с zoom и согласован с шириной строки', async () => {
    // zoom=2 → fontSize 16*2 = 32px; ширина строки масштабируется тем же множителем
    // (нет двойного масштабирования: раскладка в px * zoom, рендер fontSize * zoom)
    storeHolder.value = buildStore(2)
    const wrapper = mount(LabelCanvas, {
      global: {
        stubs: {
          VueDraggableResizable: { template: '<div class="vdr-stub"><slot /></div>' },
          'v-icon': true
        }
      }
    })
    await wrapper.vm.$nextTick()
    await new Promise((r) => setTimeout(r, 0))
    await wrapper.vm.$nextTick()

    const lineEls = wrapper
      .findAll('.canvas-label div')
      .filter((d) => (d.element as HTMLElement).style.whiteSpace === 'pre')

    expect(lineEls.length).toBeGreaterThan(0)
    for (const line of lineEls) {
      const style = (line.element as HTMLElement).style
      // Размер шрифта = tp.fontSize × zoom (как в прежней рабочей версии канваса)
      expect(style.fontSize).toBe('32px')
      // Единицы и положительные размеры при zoom=2
      expect(style.left).toMatch(/^-?[\d.]+px$/)
      expect(style.top).toMatch(/^-?[\d.]+px$/)
      expect(parseFloat(style.width)).toBeGreaterThan(0)
    }
  })

  it('поворот 90°: content-контейнер свопается и центрируется, перенос под новую ширину (баг «перенос по исходной ширине»)', async () => {
    storeHolder.value = buildStore(1, 90)
    const wrapper = mount(LabelCanvas, {
      global: {
        stubs: {
          VueDraggableResizable: { template: '<div class="vdr-stub"><slot /></div>' },
          'v-icon': true
        }
      }
    })
    await wrapper.vm.$nextTick()
    await new Promise((r) => setTimeout(r, 0))
    await wrapper.vm.$nextTick()

    // Длинный текст перенесён по «новой ширине» (innerH) при повороте 90°
    const lineEls = wrapper
      .findAll('.canvas-label div')
      .filter((d) => (d.element as HTMLElement).style.whiteSpace === 'pre')
    expect(lineEls.length).toBeGreaterThan(1)

    // content-контейнер (position:absolute + overflow:hidden): блок t1 30x40мм
    // → posToPx = 113x151 px; при 90 свопнутый бокс = 151x113 px, сдвиг (-19, 19),
    // чтобы внешний rotate(90) вокруг его центра держал текст внутри блока
    const contentEls = wrapper
      .findAll('.canvas-label div')
      .filter((d) => (d.element as HTMLElement).style.overflow === 'hidden')
    const rotatedContent = contentEls.find((d) => {
      const s = (d.element as HTMLElement).style
      return (
        s.position === 'absolute' && parseFloat(s.width) === 151 && parseFloat(s.height) === 113
      )
    })
    expect(rotatedContent).toBeTruthy()
    const cs = (rotatedContent!.element as HTMLElement).style
    expect(parseFloat(cs.left)).toBeCloseTo(-19, 6)
    expect(parseFloat(cs.top)).toBeCloseTo(19, 6)
  })
})
