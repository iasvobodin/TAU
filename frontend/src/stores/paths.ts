import { defineStore } from 'pinia'
import { ref, computed } from 'vue'
import { loadPathsConfig, savePathsConfig, type AppPaths } from '@/assets/utils/pathConfig'
import { appConfig } from '@/assets/utils/AppConfig'

const DEFAULT_PATHS: AppPaths = {
  ok: '//rucekaspinffs05.metran.local/Dept-MP/Production/Internal/Продукты/ТАУ/Операционные карты',
  okPdf:
    '//rucekaspinffs05.metran.local/Dept-MP/Production/Internal/Продукты/ТАУ/Операционные карты/ОК PDF',
  kd: '//rucekaspinffs05.metran.local/Dept-MP/Production/Internal/Продукты/ТАУ/КД',
  passports: '//rucekaspinffs05.metran.local/Dept-MP/Production/Internal/Продукты/ТАУ/Паспорта',
  marking:
    '//rucekaspinffs05.metran.local/Dept-MP/Production/Internal/Продукты/ТАУ/Наклейки/Гравировка',
  other:
    '//rucekaspinffs05.metran.local/Dept-MP/Production/Internal/Продукты/ТАУ/Софт/прикладные документы',
  convertFolder: './convertFolder',
  resourcesPath: '/frontend/dist/'
}

export const usePathsStore = defineStore('paths', () => {
  const paths = ref<AppPaths>({ ...DEFAULT_PATHS })
  const loaded = ref(false)

  /**
   * effectiveConvertFolder — возвращает актуальный путь к convertFolder.
   *
   * Приоритет:
   *   1. sharedPaths.convertFolder (UNC из config.json) — если указан
   *   2. paths.convertFolder (из config.json / pathsConfig.json)
   *   3. DEFAULT_PATHS.convertFolder
   *
   * После внедрения Launcher'а config.json содержит UNC-путь к convertFolder,
   * поэтому paths.convertFolder уже должен быть UNC. Но на случай, если
   * sharedPaths задан отдельно — используем его.
   */
  const effectiveConvertFolder = computed(() => {
    const shared = appConfig.sharedPaths
    if (shared?.convertFolder) {
      return shared.convertFolder
    }
    return paths.value.convertFolder
  })

  /**
   * Путь к общей storage-папке (для yandexWatcher и других shared-данных)
   */
  const effectiveStoragePath = computed(() => {
    const shared = appConfig.sharedPaths
    if (shared?.storage) {
      return shared.storage
    }
    // Если shared не указан — пробуем paths.storage, иначе null
    return null
  })

  /**
   * Загрузить пути из конфига.
   * Должен быть вызван при старте приложения (до монтирования Vue).
   */
  async function loadPaths(): Promise<void> {
    if (loaded.value) return
    // Убеждаемся, что appConfig загружен
    if (!appConfig.paths.ok) {
      await appConfig.load()
    }
    paths.value = await loadPathsConfig()
    loaded.value = true
  }

  /**
   * Обновить один путь и сохранить конфиг
   */
  async function updatePath<K extends keyof AppPaths>(key: K, value: string): Promise<void> {
    paths.value[key] = value
    await savePathsConfig(paths.value)
  }

  /**
   * Сбросить все пути на дефолтные (из хардкода)
   */
  async function resetToDefaults(): Promise<void> {
    paths.value = { ...DEFAULT_PATHS }
    await savePathsConfig(paths.value)
  }

  return {
    paths,
    loaded,
    effectiveConvertFolder,
    effectiveStoragePath,
    loadPaths,
    updatePath,
    resetToDefaults
  }
})
