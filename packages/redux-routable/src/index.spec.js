import { createMemoryHistory } from 'history'
import { applyMiddleware, createStore } from 'redux'
import configureStore from 'redux-mock-store'
import {
  Fallback,
  LOCATION_NOT_MATCHED,
  LocationMatchError,
  ROUTE_CHANGED,
  ROUTE_NOT_MATCHED,
  Redirect,
  Route,
  RouteMatchError,
  Router,
  Scope,
  changedTo,
  createMiddleware,
  entered,
  exited,
  go,
  goBack,
  goForward,
  open,
  paramsReducer,
  push,
  replace,
  sync,
} from './index'

const userRouter = Router([
  Route('users'),
  Route('userAdmin', '/admin'),
  Route('user', '/:userId'),
])

const accountRouter = Router([
  Redirect('users'),
  Redirect('userAdmin', '/admin'),
  Redirect('user', '/:userId'),
])

const contactRouter = Router([
  Route('contactByEmail', '/email'),
  Fallback('contactNotFound'),
])

const mockRouter = Router([
  Route('home', '/'),
  Route('cart', '/cart'),
  Route('search', '/search/:category?'),
  Route('item', '/item/:itemId'),
  Redirect('item', '/product/:itemId'),
  Scope('/user', userRouter),
  Scope('/account', accountRouter),
  Scope('/contact', contactRouter),
  Fallback('notFound'),
])

const mocks = ({ historyOptions, reducer, router = mockRouter } = {}) => {
  const history = createMemoryHistory(historyOptions)
  const middleware = createMiddleware(router, history)
  const store = reducer
    ? createStore(reducer, applyMiddleware(middleware))
    : configureStore([middleware])()

  window.open = jest.fn()

  return { store, history }
}

describe('middleware', () => {
  test('does not allow navigation actions to pass through', () => {
    const { store } = mocks()
    const actions = [
      push('home'),
      replace('home'),
      open('home'),
      go(-1),
      goBack(),
      goForward(),
    ]

    actions.forEach(action => {
      store.dispatch(action)
      expect(store.getActions()).not.toContainEqual(action)
      store.clearActions()
    })
  })

  test('allows other actions to pass through', () => {
    const { store } = mocks()
    const action = { type: 'TEST' }

    store.dispatch(action)
    expect(store.getActions()).toContainEqual(action)
  })

  test('keeps track of previous ROUTE_CHANGED action', () => {
    const { store } = mocks()

    store.dispatch(replace('cart'))
    store.dispatch(replace('home'))

    const [{ payload }, { meta }] = store.getActions()

    expect(meta.previous).toEqual(payload)
  })
})

describe('helpers', () => {
  test('paramsReducer() creates a reducer for params for a single route', () => {
    const reducer = paramsReducer('item', ({ itemId }) => itemId)
    const { store } = mocks({ reducer })

    expect(store.getState()).toBe(null)
    store.dispatch(replace('item', { itemId: '123' }))
    expect(store.getState()).toBe('123')
    store.dispatch(replace('home'))
    expect(store.getState()).toBe(null)
  })

  test('paramsReducer() creates a reducer for params for multiple routes', () => {
    const reducer = paramsReducer(
      ['item', 'user'],
      ({ userId, itemId }) => userId || itemId,
    )
    const { store } = mocks({ reducer })

    expect(store.getState()).toBe(null)
    store.dispatch(replace('item', { itemId: '123' }))
    expect(store.getState()).toBe('123')
    store.dispatch(replace('user', { userId: '456' }))
    expect(store.getState()).toBe('456')
    store.dispatch(replace('home'))
    expect(store.getState()).toBe(null)
  })

  test('paramsReducer() accepts an awayVal', () => {
    const reducer = paramsReducer('item', '123', ({ itemId }) => itemId)
    const { store } = mocks({ reducer })

    expect(store.getState()).toBe('123')
    store.dispatch(replace('item', { itemId: '456' }))
    expect(store.getState()).toBe('456')
    store.dispatch(replace('home'))
    expect(store.getState()).toBe('123')
  })

  test('changedTo() creates an action predicate for a single route', () => {
    const { store } = mocks()
    const changedToCart = changedTo('cart')

    store.dispatch(replace('home'))
    store.dispatch(replace('cart'))
    expect(store.getActions().map(changedToCart)).toEqual([false, true])
  })

  test('changedTo() creates an action predicate for multiple routes', () => {
    const { store } = mocks()
    const changedToCartOrSearch = changedTo(['cart', 'search'])

    store.dispatch(replace('home'))
    store.dispatch(replace('cart'))
    store.dispatch(replace('search'))
    expect(store.getActions().map(changedToCartOrSearch)).toEqual([
      false,
      true,
      true,
    ])
  })

  test('entered() creates an action predicate for a single route', () => {
    const { store } = mocks()
    const homeEntered = entered('home')
    const cartEntered = entered('cart')

    store.dispatch(replace('home'))
    store.dispatch(replace('cart'))
    expect(store.getActions().map(homeEntered)).toEqual([true, false])
    expect(store.getActions().map(cartEntered)).toEqual([false, true])
  })

  test('entered() creates an action predicate for multiple routes', () => {
    const { store } = mocks()
    const homeOrCartEntered = entered(['home', 'cart'])

    store.dispatch(replace('home'))
    store.dispatch(replace('item', { itemId: '123' }))
    store.dispatch(replace('cart'))
    expect(store.getActions().map(homeOrCartEntered)).toEqual([
      true,
      false,
      true,
    ])
  })

  test('exited() creates an action predicate for a single route', () => {
    const { store } = mocks()
    const homeExited = exited('home')
    const cartExited = exited('cart')

    store.dispatch(replace('home'))
    store.dispatch(replace('cart'))
    store.dispatch(replace('item', { itemId: '123' }))
    expect(store.getActions().map(homeExited)).toEqual([false, true, false])
    expect(store.getActions().map(cartExited)).toEqual([false, false, true])
  })

  test('exited() creates an action predicate for multiple routes', () => {
    const { store } = mocks()
    const homeOrCartExited = exited(['home', 'cart'])

    store.dispatch(replace('home'))
    store.dispatch(replace('item', { itemId: '123' }))
    store.dispatch(replace('cart'))
    store.dispatch(replace('item', { itemId: '123' }))
    expect(store.getActions().map(homeOrCartExited)).toEqual([
      false,
      true,
      false,
      true,
    ])
  })
})

describe('side effects', () => {
  test('dispatching SYNC action dispatches ROUTE_CHANGED action for current location', () => {
    const historyOptions = { initialEntries: ['/item/123'] }
    const { store } = mocks({ historyOptions })

    store.dispatch(sync())

    const [{ type, payload }] = store.getActions()

    expect(type).toBe(ROUTE_CHANGED)
    expect(payload).toEqual({
      route: 'item',
      params: { itemId: '123' },
      hash: '',
    })
  })

  test('dispatching PUSH action adds entry to history stack', () => {
    const { store, history } = mocks()

    store.dispatch(push('home'))
    expect(history.length).toBe(2)
  })

  test('dispatching REPLACE action does not add entry to history stack', () => {
    const { store, history } = mocks()

    store.dispatch(replace('home'))
    expect(history.length).toBe(1)
  })

  test('dispatching OPEN action calls window.open()', () => {
    const { store } = mocks()

    store.dispatch(open('home'))
    expect(window.open).toHaveBeenCalled()
  })

  test('dispatching GO action navigates history stack', () => {
    const initialEntries = ['/a', '/b', '/c', '/d']
    const historyOptions = { initialEntries, initialIndex: 3 }
    const { store, history } = mocks({ historyOptions })

    store.dispatch(go(-3))
    expect(history.index).toBe(0)
    store.dispatch(go(2))
    expect(history.index).toBe(2)
  })

  test('dispatching GO_BACK action navigates history stack', () => {
    const initialEntries = ['/a', '/b']
    const historyOptions = { initialEntries, initialIndex: 1 }
    const { store, history } = mocks({ historyOptions })

    store.dispatch(goBack())
    expect(history.index).toBe(0)
  })

  test('dispatching GO_FORWARD action navigates history stack', () => {
    const initialEntries = ['/a', '/b']
    const historyOptions = { initialEntries }
    const { store, history } = mocks({ historyOptions })

    store.dispatch(goForward())
    expect(history.index).toBe(1)
  })
})

describe('match error actions', () => {
  test('navigating to route that does not exist dispatches ROUTE_NOT_MATCHED action', () => {
    const { store } = mocks({ router: Router([]) })

    store.dispatch(replace('nonsense'))

    const [{ type, payload, error, meta }] = store.getActions()

    expect(type).toEqual(ROUTE_NOT_MATCHED)
    expect(error).toBe(true)
    expect(payload).toBeInstanceOf(RouteMatchError)
    expect(meta).toEqual({ route: 'nonsense', params: {}, hash: '' })
  })

  test('navigating to route with invalid params dispatches ROUTE_NOT_MATCHED action', () => {
    const { store } = mocks()

    store.dispatch(replace('item'))

    const [{ type, payload, error, meta }] = store.getActions()

    expect(type).toEqual(ROUTE_NOT_MATCHED)
    expect(error).toBe(true)
    expect(payload).toBeInstanceOf(RouteMatchError)
    expect(meta).toEqual({ route: 'item', params: {}, hash: '' })
  })

  test('changing to location that does not match a route dispatches LOCATION_NOT_MATCHED action', () => {
    const { store, history } = mocks({ router: Router([]) })

    history.replace('/nonsense')

    const [{ type, payload, error, meta }] = store.getActions()

    expect(type).toEqual(LOCATION_NOT_MATCHED)
    expect(error).toBe(true)
    expect(payload).toBeInstanceOf(LocationMatchError)
    expect(meta).toMatchObject({ location: { pathname: '/nonsense' } })
  })
})

describe('an error is thrown', () => {
  test('when a route is not passed to a router configuration function', () => {
    expect(() => Route()).toThrow(TypeError)
    expect(() => Redirect()).toThrow(TypeError)
    expect(() => Fallback()).toThrow(TypeError)
  })

  test('when a non-string path is passed to a router configuration function', () => {
    expect(() => Route('test', 123)).toThrow(TypeError)
    expect(() => Redirect('test', 123)).toThrow(TypeError)
    expect(() => Fallback('test', 123)).toThrow(TypeError)
    expect(() => Scope(123, Router([]))).toThrow(TypeError)
  })

  test('when a Router is not passed to a Scope', () => {
    expect(() => Scope('/test')).toThrow(TypeError)
  })

  test('when invalid children are passed to a Router', () => {
    expect(() => Router('nonsense')).toThrow(TypeError)
  })

  test('when an invalid child is passed to a Router', () => {
    expect(() => Router(['nonsense'])).toThrow(TypeError)
  })
})

describe('changing the location', () => {
  const tests = [
    ['', 'home', {}, ''],
    ['/', 'home', {}, ''],
    ['/cart', 'cart', {}, ''],
    ['/search', 'search', {}, ''],
    ['/search/widgets', 'search', { category: 'widgets' }, ''],
    ['/search?query=devices', 'search', { query: 'devices' }, ''],
    ['/search#items', 'search', {}, '#items'],
    ['/item/123', 'item', { itemId: '123' }, ''],
    ['/item', 'notFound', {}, ''],
    ['/product/123', 'item', { itemId: '123' }, ''],
    ['/user', 'users', {}, ''],
    ['/user/456', 'user', { userId: '456' }, ''],
    ['/user/admin', 'userAdmin', {}, ''],
    ['/account', 'users', {}, ''],
    ['/account/456', 'user', { userId: '456' }, ''],
    ['/account/admin', 'userAdmin', {}, ''],
    ['/contact/email', 'contactByEmail', {}, ''],
    ['/contact/nonsense', 'contactNotFound', {}, ''],
    ['/nonsense', 'notFound', {}, ''],
  ]

  tests.forEach(([path, route, params, hash]) => {
    test(`dispatches ROUTE_CHANGED action when changed to '${path}'`, () => {
      const { store, history } = mocks()

      history.replace(path)

      const [{ type, payload }] = store.getActions()

      expect(type).toBe(ROUTE_CHANGED)
      expect(payload).toEqual({ route, params, hash })
    })
  })
})

describe('dispatching a navigation action', () => {
  const tests = [
    ['home', undefined, undefined, '/'],
    ['cart', undefined, undefined, '/cart'],
    ['search', undefined, undefined, '/search'],
    ['search', { category: 'widgets' }, undefined, '/search/widgets'],
    ['search', { query: 'devices' }, undefined, '/search?query=devices'],
    ['search', undefined, '#items', '/search#items'],
    ['item', { itemId: '123' }, undefined, '/item/123'],
    ['users', undefined, undefined, '/user'],
    ['user', { userId: '456' }, undefined, '/user/456'],
    ['userAdmin', undefined, undefined, '/user/admin'],
    ['contactByEmail', undefined, undefined, '/contact/email'],
  ]

  tests.forEach(([route, params, hash, path]) => {
    test(`changes location to '${path}'`, () => {
      const { store, history } = mocks()

      store.dispatch(replace(route, params, hash))
      expect(history.createHref(history.location)).toBe(path)
    })
  })
})
