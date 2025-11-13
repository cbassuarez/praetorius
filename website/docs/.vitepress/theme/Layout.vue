<template>
  <Layout>
    <template #nav-bar-title-before>
      <NavLogo />
    </template>
    <template #nav-bar-content-after>
      <NpmInstall />
    </template>
  </Layout>
</template>

<script setup lang="ts">
import DefaultTheme from 'vitepress/theme'
import NavLogo from './components/NavLogo.vue'
import NpmInstall from './components/NpmInstall.vue'

const { Layout } = DefaultTheme
</script>
