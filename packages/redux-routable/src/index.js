import pathToRegexp from 'path-to-regexp'
import queryString from 'query-string'

// Action Types
const SYNC = '@@reduxRoutable/SYNC'
const PUSH = '@@reduxRoutable/PUSH'
const REPLACE = '@@reduxRoutable/REPLACE'
const OPEN = '@@reduxRoutable/OPEN'
const GO = '@@reduxRoutable/GO'
const GO_BACK = '@@reduxRoutable/GO_BACK'
const GO_FORWARD = '@@reduxRoutable/GO_FORWARD'
export const ROUTE_CHANGED = '@@reduxRoutable/ROUTE_CHANGED'

// Action Creators
export const sync = () => ({
  type: SYNC,
})

export const push = (route, params = {}, hash = '') => ({
  type: PUSH,
  payload: { route, params, hash },
})

export const replace = (route, params = {}, hash = '') => ({
  type: REPLACE,
  payload: { route, params, hash },
})

export const open = (route, params = {}, hash = '') => ({
  type: OPEN,
  payload: { route, params, hash },
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

export const routeChanged = (route, params, hash, previous) => ({
  type: ROUTE_CHANGED,
  payload: { route, params, hash },
  meta: { previous },
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

export function Fallback(name, path = '') {
  const pattern = pathToRegexp(path, null, { end: false })
  return create(Fallback, { name, path: '', pattern })
}

export function Scope(base, router) {
  const scopedRoutes = router.routes.map(route => {
    switch (route.constructor) {
      case Fallback:
        return Fallback(route.name, base + route.path)
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
export const paramsReducer = (route, defaultVal, paramsSelector) => {
  const routes = route instanceof Array ? route : [route]

  return (state = defaultVal, { type, payload }) => {
    if (type === ROUTE_CHANGED) {
      if (routes.includes(payload.route)) {
        return paramsSelector(payload.params)
      } else {
        return defaultVal
      }
    } else {
      return state
    }
  }
}

export const isRouteAction = route => {
  const routes = route instanceof Array ? route : [route]

  return ({ type, payload }) =>
    type === ROUTE_CHANGED && routes.includes(payload.route)
}

export const routeEntered = route => {
  const routes = route instanceof Array ? route : [route]

  return ({ type, payload, meta }) =>
    type === ROUTE_CHANGED &&
    routes.includes(payload.route) &&
    (meta.previous === undefined || !routes.includes(meta.previous.route))
}

export const routeExited = route => {
  const routes = route instanceof Array ? route : [route]

  return ({ type, payload, meta }) =>
    type === ROUTE_CHANGED &&
    !routes.includes(payload.route) &&
    (meta.previous !== undefined && routes.includes(meta.previous.route))
}

// Utilities
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

// Route/Location Translation
export const routeToLocation = (router, name, params, hash) => {
  const route = router.routes.find(
    route => route instanceof Route && route.name === name,
  )

  if (route === undefined) {
    throw Error(`No route found with name '${name}'`)
  }

  const pathParamNames = getPathParamNames(route.path)
  const pathParams = keyFilter(params, key => pathParamNames.includes(key))
  const queryParams = keyFilter(params, key => !pathParamNames.includes(key))
  const pathname = pathToRegexp.compile(route.path)(pathParams)
  const search = queryString.stringify(queryParams)

  return { pathname, search, hash }
}

export const locationToRoute = (router, { pathname, search, hash }) => {
  const route = router.routes.find(route => route.pattern.test(pathname))

  if (route === undefined) {
    throw Error(`No route found matching path '${pathname}'`)
  }

  const pathParamNames = getPathParamNames(route.path)
  const pathParamValues = route.pattern.exec(pathname).slice(1)
  const pathParams = pathParamNames.reduce((params, name, index) => {
    const value = pathParamValues[index]
    if (value !== undefined) params[name] = value
    return params
  }, {})
  const queryParams = queryString.parse(search)
  const params = { ...pathParams, ...queryParams }

  return { route, params, hash }
}

// Middleware
const isAbsoluteAction = ({ type }) => [PUSH, REPLACE, OPEN].includes(type)

const isRelativeAction = ({ type }) => [GO, GO_BACK, GO_FORWARD].includes(type)

export const createMiddleware = (router, history) => store => {
  let previous

  const historyListener = location => {
    const { route, params, hash } = locationToRoute(router, location)

    if (route instanceof Redirect) {
      history.replace(routeToLocation(router, route.to, params, hash))
    } else {
      store.dispatch(routeChanged(route.name, params, hash, previous))
    }
  }

  history.listen(historyListener)

  return next => action => {
    if (action.type === SYNC) {
      historyListener(history.location)
    } else if (isAbsoluteAction(action)) {
      const { route, params, hash } = action.payload
      const location = routeToLocation(router, route, params, hash)

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
      if (action.type === ROUTE_CHANGED) {
        previous = action.payload
      }

      return next(action)
    }
  }
}
