---
type: llm
weight: 1
---

PASS si la solucion es un marquee seamless (dos mitades duplicadas con aria-hidden en el clon) que
respeta prefers-reduced-motion y pausa o al menos lo menciona; en Astro el script va vanilla (sin isla React).
FAIL si ignora reduced-motion, duplica mal la cinta (salto en la costura) o mete una isla React solo para esto.
