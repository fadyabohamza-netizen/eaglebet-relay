# Relay كاشير Eagle Bet — جاهز لـ Render (Docker)
#
# Render يمرّر PORT تلقائياً (افتراضياً 10000) والـrelay يستمع على 0.0.0.0.
# لا تضع أي سرّ داخل الصورة: RELAY_KEY يأتي من Environment على Render.
FROM node:20-alpine

WORKDIR /app
COPY relay.mjs ./

ENV NODE_ENV=production
ENV PORT=8080
EXPOSE 8080

USER node
CMD ["node", "relay.mjs"]
