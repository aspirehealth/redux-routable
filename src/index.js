import pathToRegexp from 'path-to-regexp'
import queryString from 'query-string'

// Action Types
const SYNC = '@@reduxRouter/SYNC'
const PUSH = '@@reduxRouter/PUSH'
const REPLACE = '@@reduxRouter/REPLACE'
const OPEN = '@@reduxRouter/OPEN'
const GO = '@@reduxRouter/GO'
const GO_BACK = '@@reduxRouter/GO_BACK'
const GO_FORWARD = '@@reduxRouter/GO_FORWARD'
export const ROUTE_CHANGED = '@@reduxRouter/ROUTE_CHANGED'

// Action Creators
export const sync = () => ({
  type: SYNC,
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

export const routeChanged = (route, params) => ({
  type: ROUTE_CHANGED,
  payload: { route, params },
})

// Router Configuration
const create = (constructor, properties) => {
  const instance = Object.create(constructor.prototype)
  return Object.assign(instance, properties)
}

export function Route(name, path = '') {
  return create(Route, { name, path, pattern: pathToRegexp(path) })
}

export function Redirect(to, path = '') {
  return create(Redirect, { to, path, pattern: pathToRegexp(path) })
}

export function Fallback(name) {
  return create(Fallback, { name })
}

export function Scope(base, router) {
  const scopedRoutes = router.routes.map(route => {
    switch (route.constructor) {
      case Fallback:
        throw Error('A Fallback is not allowed within a Scope')
      case Redirect:
        return Redirect(route.to, base + route.path)
      case Route:
        return Route(route.name, base + route.path)
    }
  })

  return create(Scope, { base, routes: scopedRoutes })
}

export function Router(routes) {
  const resolvedRoutes = routes.reduce((routes, route) => {
    switch (route.constructor) {
      case Router:
        throw Error('A Router is not allowed within a Router')
      case Scope:
        return routes.concat(route.routes)
      case Fallback:
      case Redirect:
      case Route:
        return routes.concat([route])
    }
  }, [])

  return create(Router, { routes: resolvedRoutes })
}

// Helpers
export const routeReducer = (route, reducer) => (state, action) => {
  if (action.type === ROUTE_CHANGED && action.payload.route === route) {
    return reducer(state, action)
  } else {
    return state
  }
}

export const isRouteAction = route => ({ type, payload }) =>
  type === ROUTE_CHANGED && payload.route === route

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
  const route = router.routes.find(route => {
    switch (route.constructor) {
      case Fallback:
      case Redirect:
        return false
      case Route:
        return route.name === name
    }
  })

  if (route === undefined) {
    throw Error(`No route found with name '${name}'`)
  }

  const pathParamNames = getPathParamNames(route.path)
  const pathParams = keyFilter(params, key => pathParamNames.includes(key))
  const queryParams = keyFilter(params, key => !pathParamNames.includes(key))
  const pathname = pathToRegexp.compile(route.path)(pathParams)
  const search = queryString.stringify(queryParams)

  return { pathname, search }
}

const locationToRoute = (router, location) => {
  const route = router.routes.find(route => {
    switch (route.constructor) {
      case Fallback:
        return true
      case Redirect:
      case Route:
        return route.pattern.test(location.pathname)
    }
  })

  if (route === undefined) {
    throw Error(`No route found matching location '${location.pathname}'`)
  }

  if (route instanceof Fallback) {
    return { route, params: {} }
  }

  const pathParamNames = getPathParamNames(route.path)
  const pathParamValues = route.pattern.exec(location.pathname).slice(1)
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
  const historyListener = location => {
    const { route, params } = locationToRoute(router, location)

    if (route instanceof Redirect) {
      history.replace(routeToLocation(router, route.to, params))
    } else {
      store.dispatch(routeChanged(route.name, params))
    }
  }

  history.listen(historyListener)

  return next => action => {
    if (action.type === SYNC) {
      historyListener(history.location)
    } else if (isAbsoluteAction(action)) {
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
