<template>
  <v-container>
    <v-row v-for="(stage, index) in stages" :key="index">
      <!-- <div :class="isVertical ? 'vertical-flow' : 'horizontal-flow'"> -->
      <!-- <template > -->
      <!-- Карточка этапа -->

      <v-card
        :color="defectWorkflowMap[stage].color || '#000000'"
        class="pa-1 text-center elevation-2 workflow-card"
        :text="defectWorkflowMap[stage].desc"
        :title="stage"
      >
        <!-- <v-card-title class="white--text text-subtitle-2 px-2 py-1">
            {{ stage }}
          </v-card-title> -->
        <!-- <v-card-subtitle>
            {{ defectWorkflowMap[stage].desc }}
          </v-card-subtitle> -->
      </v-card>

      <!-- Стрелка -->
      <!-- <div
          v-if="index < stages.length - 1"
          class="arrow"
        >
          <v-icon size="18">
            {{ isVertical ? 'mdi-arrow-down' : 'mdi-arrow-right' }}
          </v-icon>
        </div> -->
      <!-- </template> -->
      <!-- </div> -->
    </v-row>

    <!-- Переключатель ориентации -->
    <!-- <div class="mt-4 text-center">
      <v-btn @click="isVertical = !isVertical" color="primary" size="small" variant="outlined">
        Переключить на {{ isVertical ? 'горизонтальный' : 'вертикальный' }} режим
      </v-btn>
    </div> -->
  </v-container>
</template>

<script setup lang="ts">
import { ref, computed } from 'vue'
import { defectWorkflowMap, type DefectStage } from '@/assets/interfaces'

const stages = computed(() => Object.keys(defectWorkflowMap) as DefectStage[])

const isVertical = ref(false)
</script>

<style scoped>
.horizontal-flow,
.vertical-flow {
  display: flex;
  align-items: center;
  justify-content: center;
  flex-wrap: nowrap;
  overflow-x: auto;
}

.vertical-flow {
  flex-direction: column;
}

.workflow-card {
  min-width: 300px;
  /* min-height: 150px; */
  border-radius: 8px;
  margin: 4px;
  font-size: 0.8rem;
  line-height: 1.1rem;
  padding: 0;
}

.arrow {
  display: flex;
  align-items: center;
  justify-content: center;
  color: #555;
  margin: 4px;
}
</style>
