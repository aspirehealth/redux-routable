import pathToRegexp from 'path-to-regexp'
import queryString from 'query-string'

// Errors
export class RouteMatchError extends Error {}
export class LocationMatchError extends Error {}

// Action Types
const createType = type => '@@reduxRoutable/' + type

const SYNC = createType('SYNC')
const PUSH = createType('PUSH')
const REPLACE = createType('REPLACE')
const OPEN = createType('OPEN')
const GO = createType('GO')
const GO_BACK = createType('GO_BACK')
const GO_FORWARD = createType('GO_FORWARD')
export const ROUTE_CHANGED = createType('ROUTE_CHANGED')
export const ROUTE_NOT_MATCHED = createType('ROUTE_NOT_MATCHED')
export const LOCATION_NOT_MATCHED = createType('LOCATION_NOT_MATCHED')

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

const routeChanged = (route, params, hash, previous) => ({
  type: ROUTE_CHANGED,
  payload: { route, params, hash },
  meta: { previous },
})

const routeNotMatched = (error, route, params, hash) => ({
  type: ROUTE_NOT_MATCHED,
  error: true,
  payload: error,
  meta: { route, params, hash },
})

const locationNotMatched = (error, location) => ({
  type: LOCATION_NOT_MATCHED,
  error: true,
  payload: error,
  meta: { location },
})

// Router Configuration
const createConfig = (constructor, properties) => {
  const instance = Object.create(constructor.prototype)
  return Object.assign(instance, properties)
}

export function Route(name, path = '') {
  if (name === undefined) {
    throw new TypeError("'name' cannot be undefined")
  }

  if (typeof path !== 'string') {
    throw new TypeError(`${path} is not a string`)
  }

  return createConfig(Route, { name, path, pattern: pathToRegexp(path) })
}

export function Redirect(to, path = '') {
  if (to === undefined) {
    throw new TypeError("'to' cannot be undefined")
  }

  if (typeof path !== 'string') {
    throw new TypeError(`${path} is not a string`)
  }

  return createConfig(Redirect, { to, path, pattern: pathToRegexp(path) })
}

export function Fallback(name, path = '') {
  if (name === undefined) {
    throw new TypeError("'name' cannot be undefined")
  }

  if (typeof path !== 'string') {
    throw new TypeError(`${path} is not a string`)
  }

  const pattern = pathToRegexp(path, null, { end: false })

  return createConfig(Fallback, { name, path: '', pattern })
}

export function Scope(base, router) {
  if (typeof base !== 'string') {
    throw new TypeError(`${base} is not a string`)
  }

  if (!(router instanceof Router)) {
    throw new TypeError(`${router} is not a Router`)
  }

  const scopedChildren = router.children.map(child => {
    switch (child.constructor) {
      case Fallback:
        return Fallback(child.name, base + child.path)
      case Redirect:
        return Redirect(child.to, base + child.path)
      case Route:
        return Route(child.name, base + child.path)
    }
  })

  return createConfig(Scope, { base, children: scopedChildren })
}

export function Router(children) {
  if (!(children instanceof Array)) {
    throw new TypeError(`${children} is not an Array`)
  }

  const resolvedChildren = children.reduce((children, child) => {
    switch (child.constructor) {
      case Scope:
        return children.concat(child.children)
      case Fallback:
      case Redirect:
      case Route:
        return children.concat([child])
      default:
        throw new TypeError(`${child} is not a valid Router child`)
    }
  }, [])

  return createConfig(Router, { children: resolvedChildren })
}

// Helpers
export const match = (route, matchable) => {
  if (typeof matchable === 'object') {
    switch (matchable.constructor) {
      case Route:
      case Fallback:
        return match(route, matchable.name)
      case Router:
      case Scope:
        return match(route, matchable.children)
      case Array:
        return matchable.some(child => match(route, child))
      default:
        return route === matchable
    }
  } else {
    return route === matchable
  }
}

export const paramsReducer = (matchable, ...rest) => {
  const [awayVal, paramsSelector] = rest.length === 1 ? [null, ...rest] : rest

  return (state = awayVal, { type, payload }) => {
    if (type === ROUTE_CHANGED) {
      if (match(payload.route, matchable)) {
        return paramsSelector(payload.params)
      } else {
        return awayVal
      }
    } else {
      return state
    }
  }
}

export const changedTo = matchable => ({ type, payload }) =>
  type === ROUTE_CHANGED && match(payload.route, matchable)

export const entered = matchable => ({ type, payload, meta }) =>
  type === ROUTE_CHANGED &&
  match(payload.route, matchable) &&
  (meta.previous === undefined || !match(meta.previous.route, matchable))

export const exited = matchable => ({ type, payload, meta }) =>
  type === ROUTE_CHANGED &&
  !match(payload.route, matchable) &&
  (meta.previous !== undefined && match(meta.previous.route, matchable))

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
  const route = router.children.find(
    child => child instanceof Route && child.name === name,
  )

  if (route === undefined) {
    throw new RouteMatchError(`No route matching route name: ${name}`)
  }

  const pathParamNames = getPathParamNames(route.path)
  const pathParams = keyFilter(params, key => pathParamNames.includes(key))
  const queryParams = keyFilter(params, key => !pathParamNames.includes(key))
  const search = queryString.stringify(queryParams)
  let pathname

  try {
    pathname = pathToRegexp.compile(route.path)(pathParams)
  } catch (error) {
    throw new RouteMatchError(error.message)
  }

  return { pathname, search, hash }
}

export const locationToRoute = (router, { pathname, search, hash }) => {
  const route = router.children.find(child => child.pattern.test(pathname))

  if (route === undefined) {
    throw new LocationMatchError(`No route matching location path: ${pathname}`)
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
    try {
      const { route, params, hash } = locationToRoute(router, location)

      if (route instanceof Redirect) {
        history.replace(routeToLocation(router, route.to, params, hash))
      } else {
        store.dispatch(routeChanged(route.name, params, hash, previous))
      }
    } catch (error) {
      if (error instanceof LocationMatchError) {
        store.dispatch(locationNotMatched(error, location))
      } else {
        throw error
      }
    }
  }

  history.listen(historyListener)

  return next => action => {
    if (action.type === SYNC) {
      historyListener(history.location)
    } else if (isAbsoluteAction(action)) {
      const { route, params, hash } = action.payload

      try {
        const location = routeToLocation(router, route, params, hash)

        switch (action.type) {
          case PUSH:
            history.push(location)
            break
          case REPLACE:
            history.replace(location)
            break
          case OPEN:
            window.open(history.createHref(location))
            break
        }
      } catch (error) {
        if (error instanceof RouteMatchError) {
          store.dispatch(routeNotMatched(error, route, params, hash))
        } else {
          throw error
        }
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
