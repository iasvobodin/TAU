<script setup lang="ts">
import { ref, computed } from 'vue'
import type { ManifestData, ManifestVersion } from '@/assets/utils/updateChecker'

const props = withDefaults(
  defineProps<{
    visible: boolean
    manifest?: ManifestData | null
    latestVersion?: ManifestVersion | null
  }>(),
  {
    manifest: null,
    latestVersion: null
  }
)

const emit = defineEmits<{
  (e: 'update:visible', val: boolean): void
  (e: 'update-now'): void
  (e: 'later'): void
}>()

const isCritical = computed(() => props.latestVersion?.critical ?? false)

const dialogTitle = computed(() => {
  if (isCritical.value) return '⚠️ Критическое обновление'
  return 'Доступно обновление'
})

const versionText = computed(() => {
  if (!props.latestVersion) return ''
  return `Версия ${props.latestVersion.version}`
})

const changelogLines = computed(() => {
  if (!props.latestVersion?.changelog) return []
  return props.latestVersion.changelog.split('\n').filter((l) => l.trim())
})

const showDialog = computed({
  get: () => props.visible,
  set: (val: boolean) => {
    if (!isCritical.value) {
      emit('update:visible', val)
    }
    // Если critical — диалог нельзя закрыть через overlay
  }
})

function onUpdateNow() {
  emit('update-now')
}

function onLater() {
  if (!isCritical.value) {
    emit('later')
  }
}
</script>

<template>
  <v-dialog
    :model-value="showDialog"
    :persistent="isCritical"
    max-width="560px"
    :content-class="isCritical ? 'update-dialog-critical' : ''"
  >
    <v-card>
      <!-- Header -->
      <v-card-title class="d-flex align-center pa-4">
        <v-icon :color="isCritical ? 'error' : 'warning'" size="36" class="mr-3">
          {{ isCritical ? 'mdi-alert-circle' : 'mdi-update' }}
        </v-icon>
        <span class="text-h5 font-weight-medium">{{ dialogTitle }}</span>
      </v-card-title>

      <v-divider />

      <!-- Body -->
      <v-card-text class="pa-4">
        <div class="text-body-1 mb-2">Доступна новая версия приложения:</div>
        <div class="text-h6 mb-3" style="color: rgb(var(--v-theme-primary))">
          {{ versionText }}
        </div>

        <!-- Changelog -->
        <template v-if="changelogLines.length > 0">
          <div class="text-subtitle-2 mb-1 text-medium-emphasis">Что нового:</div>
          <ul class="changelog-list mb-0">
            <li v-for="(line, i) in changelogLines" :key="i">
              {{ line.replace(/^-\s*/, '') }}
            </li>
          </ul>
        </template>

        <div v-if="isCritical" class="mt-3 text-error text-body-2">
          <v-icon size="16" class="mr-1">mdi-information</v-icon>
          Это критическое обновление. Пожалуйста, установите его сейчас.
        </div>
      </v-card-text>

      <v-divider />

      <!-- Actions -->
      <v-card-actions class="pa-4">
        <v-spacer />

        <v-btn v-if="!isCritical" variant="text" color="grey" @click="onLater">
          Напомнить позже
        </v-btn>

        <v-btn
          variant="elevated"
          :color="isCritical ? 'error' : 'primary'"
          @click="onUpdateNow"
          class="ml-2"
        >
          <v-icon start>mdi-download</v-icon>
          Обновить сейчас
        </v-btn>
      </v-card-actions>
    </v-card>
  </v-dialog>
</template>

<style scoped>
.changelog-list {
  padding-left: 1.2rem;
  line-height: 1.6;
}

.changelog-list li {
  font-size: 0.9rem;
  color: rgba(var(--v-theme-on-surface), 0.85);
}

.update-dialog-critical {
  border: 2px solid rgb(var(--v-theme-error));
}
</style>
