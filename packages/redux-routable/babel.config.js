/* eslint-env node */
const options = process.env.NODE_ENV === 'test' ? {} : { modules: false }

module.exports = {
  presets: [['@babel/preset-env', options]],
}
