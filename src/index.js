import pathToRegexp from 'path-to-regexp'
import queryString from 'query-string'

// Action Types
export const NAVIGATE = '@@reduxRouter/NAVIGATE'
const PUSH = '@@reduxRouter/PUSH'
const REPLACE = '@@reduxRouter/REPLACE'
const OPEN = '@@reduxRouter/OPEN'
const GO = '@@reduxRouter/GO'
const GO_BACK = '@@reduxRouter/GO_BACK'
const GO_FORWARD = '@@reduxRouter/GO_FORWARD'

// Action Creators
const navigate = (route, params) => ({
  type: NAVIGATE,
  payload: { route, params },
})

export const push = (route, params = {}) => ({
  type: PUSH,
  payload: { route, params },
})

export const replace = (route, params = {}) => ({
  type: REPLACE,
  payload: { route, params },
})

export const open = (route, params = {}) => ({
  type: OPEN,
  payload: { route, params },
})

export const go = offset => ({
  type: GO,
  payload: offset,
})

export const goBack = () => ({
  type: GO_BACK,
})

export const goForward = () => ({
  type: GO_FORWARD,
})

// Router Configuration
const createInstance = (constructor, properties) => {
  const instance = Object.create(constructor.prototype)
  return Object.assign(instance, properties)
}

export function Route(name, path) {
  return createInstance(Route, { name, path })
}

export function Redirect(from, to) {
  return createInstance(Redirect, { from, to })
}

export function Scope(base, router) {
  return createInstance(Scope, { base, router })
}

export function Router(routes) {
  return createInstance(Router, { routes })
}

// Middleware
const getPathParamNames = path =>
  pathToRegexp
    .parse(path)
    .filter(token => token instanceof Object)
    .map(token => token.name)

const keyFilter = (object, condition) =>
  Object.entries(object).reduce((params, [key, val]) => {
    if (condition(key)) params[key] = val
    return params
  }, {})

const routeToLocation = (router, name, params) => {
  const route = router.routes.find(route => route.name === name)

  if (!route) {
    throw Error('No route found')
  }

  const pathParamNames = getPathParamNames(route.path)
  const pathParams = keyFilter(params, key => pathParamNames.includes(key))
  const queryParams = keyFilter(params, key => !pathParamNames.includes(key))
  const pathname = pathToRegexp.compile(route.path)(pathParams)
  const search = queryString.stringify(queryParams)

  return { pathname, search }
}

const locationToRoute = (router, location) => {
  const match = route => pathToRegexp(route.path).test(location.pathname)
  const route = router.routes.find(match)

  if (!route) {
    throw Error('No route found')
  }

  const pattern = pathToRegexp(route.path)
  const pathParamNames = getPathParamNames(route.path)
  const pathParamValues = pattern.exec(location.pathname).slice(1)
  const pathParams = pathParamNames.reduce((params, name, index) => {
    const value = pathParamValues[index]
    if (value !== undefined) params[name] = value
    return params
  }, {})
  const queryParams = queryString.parse(location.search)
  const params = { ...pathParams, ...queryParams }

  return { route, params }
}

const isAbsoluteAction = ({ type }) => [PUSH, REPLACE, OPEN].includes(type)

const isRelativeAction = ({ type }) => [GO, GO_BACK, GO_FORWARD].includes(type)

export const createMiddleware = (router, history) => store => {
  history.listen(location => {
    const { route, params } = locationToRoute(router, location)
    const action = navigate(route.name, params)

    store.dispatch(action)
  })

  return next => action => {
    if (isAbsoluteAction(action)) {
      const { route, params } = action.payload
      const location = routeToLocation(router, route, params)

      switch (action.type) {
        case PUSH:
          history.push(location)
          break
        case REPLACE:
          history.replace(location)
          break
        case OPEN:
          window.open(location)
          break
      }
    } else if (isRelativeAction(action)) {
      switch (action.type) {
        case GO:
          history.go(action.payload)
          break
        case GO_BACK:
          history.goBack()
          break
        case GO_FORWARD:
          history.goForward()
          break
      }
    } else {
      return next(action)
    }
  }
}
