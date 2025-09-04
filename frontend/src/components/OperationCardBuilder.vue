<template>
  <v-card class="ma-4">
    <v-card-title>Операционная карта</v-card-title>
    <v-card-text>
      <!-- Добавить пункт -->
      <v-btn color="primary" @click="openEditor">
        <v-icon left>mdi-plus</v-icon> Добавить пункт
      </v-btn>

      <!-- Список пунктов -->
      <div v-if="steps.length" class="mt-6">
        <v-row dense>
          <v-col cols="12" md="6" v-for="(step, index) in steps" :key="index">
            <v-card outlined>
              <v-img
                v-if="step.photos.length"
                :src="step.photos[0]"
                height="250"
                class="grey lighten-2"
              />

              <v-card-text>
                <h4>{{ step.title }}</h4>
                <div v-for="(desc, dIndex) in step.descriptions" :key="dIndex" class="mb-2">
                  {{ desc }}
                </div>
              </v-card-text>

              <v-card-actions>
                <v-btn icon color="warning" @click="editStep(index)">
                  <v-icon>mdi-pencil</v-icon>
                </v-btn>
                <v-btn icon color="error" @click="deleteStep(index)">
                  <v-icon>mdi-delete</v-icon>
                </v-btn>
              </v-card-actions>
            </v-card>
          </v-col>
        </v-row>
      </div>
    </v-card-text>
  </v-card>

  <!-- Диалог редактора -->
  <v-dialog v-model="editor.open" max-width="800">
    <v-card>
      <v-card-title>
        {{ editor.mode === 'edit' ? 'Редактировать' : 'Добавить' }} пункт
      </v-card-title>
      <v-card-text>
        <v-text-field v-model="editor.step.title" label="Название пункта" outlined class="mb-4" />

        <h4 class="mb-4">Описание</h4>

        <v-row dense>
          <!-- Карточки описаний -->
          <v-col cols="12" v-for="(desc, dIndex) in editor.step.descriptions" :key="'d' + dIndex">
            <v-card outlined class="d-flex flex-column justify-space-between" height="200">
              <v-card-text>
                <v-textarea v-model="editor.step.descriptions[dIndex]" outlined rows="3" />
              </v-card-text>
              <v-card-actions class="justify-center">
                <v-btn icon color="error" @click="editor.step.descriptions.splice(dIndex, 1)">
                  <v-icon>mdi-delete</v-icon>
                </v-btn>
              </v-card-actions>
            </v-card>
          </v-col></v-row
        >
        <v-row dense>
          <!-- Карточки фото -->
          <v-col cols="12" v-for="(photo, pIndex) in editor.step.photos" :key="'p' + pIndex">
            <v-card outlined class="d-flex flex-column justify-space-between" height="200">
              <v-img :src="photo" height="140" contain />
              <v-card-actions class="justify-center">
                <v-btn icon color="error" @click="editor.step.photos.splice(pIndex, 1)">
                  <v-icon>mdi-delete</v-icon>
                </v-btn>
              </v-card-actions>
            </v-card>
          </v-col>
        </v-row>

        <!-- Кнопки добавления -->
        <v-row class="mt-4" dense>
          <v-col cols="6">
            <v-btn block color="primary" @click="editor.step.descriptions.push('')">
              <v-icon left>mdi-plus</v-icon> Добавить описание
            </v-btn>
          </v-col>
          <v-col cols="6">
            <v-btn block color="primary" @click="triggerFileInput">
              <v-icon left>mdi-camera</v-icon> Добавить фото
            </v-btn>
            <input
              ref="fileInput"
              type="file"
              accept="image/*"
              style="display: none"
              @change="handleFileUpload"
            />
          </v-col>
        </v-row>
      </v-card-text>

      <v-card-actions>
        <v-spacer />
        <v-btn text @click="editor.open = false">Отмена</v-btn>
        <v-btn color="success" @click="saveStep">Сохранить</v-btn>
      </v-card-actions>
    </v-card>
  </v-dialog>
</template>

<script setup>
import { ref } from 'vue'

const steps = ref([])

const editor = ref({
  open: false,
  mode: 'add',
  index: null,
  step: {
    title: '',
    descriptions: [],
    photos: []
  }
})

const fileInput = ref(null)

function openEditor() {
  editor.value = {
    open: true,
    mode: 'add',
    index: null,
    step: { title: '', descriptions: [], photos: [] }
  }
}

function editStep(index) {
  editor.value = {
    open: true,
    mode: 'edit',
    index,
    step: JSON.parse(JSON.stringify(steps.value[index]))
  }
}

function deleteStep(index) {
  steps.value.splice(index, 1)
}

function triggerFileInput() {
  fileInput.value.click()
}

function handleFileUpload(e) {
  const file = e.target.files[0]
  if (file) {
    const url = URL.createObjectURL(file)
    editor.value.step.photos.push(url)
  }
  e.target.value = ''
}

function saveStep() {
  if (editor.value.mode === 'add') {
    steps.value.push(editor.value.step)
  } else {
    steps.value[editor.value.index] = editor.value.step
  }
  editor.value.open = false
}
</script>
