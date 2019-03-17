import { createMemoryHistory, createPath } from 'history'
import { applyMiddleware, createStore } from 'redux'
import configureStore from 'redux-mock-store'
import {
  Fallback,
  Redirect,
  Route,
  Router,
  Scope,
  createMiddleware,
  go,
  goBack,
  goForward,
  isRouteAction,
  open,
  paramsReducer,
  push,
  replace,
  routeChanged,
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

const mocks = ({ historyOptions, router = mockRouter } = {}) => {
  const history = createMemoryHistory(historyOptions)
  const middleware = createMiddleware(router, history)
  const store = configureStore([middleware])()

  window.open = jest.fn()

  return { store, history, window }
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
    expect(store.getActions()).toEqual([action])
  })

  test('keeps track of previous ROUTE_CHANGED action', () => {
    const { store } = mocks()
    const action = routeChanged('cart', {}, '')

    store.dispatch(replace('cart'))
    store.dispatch(replace('home'))
    expect(store.getActions()[1].meta.previous).toEqual(action.payload)
  })
})

describe('helpers', () => {
  test('paramsReducer() creates a route-specific reducer for params', () => {
    const reducer = paramsReducer('item', null, ({ itemId }) => itemId)
    const history = createMemoryHistory()
    const middleware = createMiddleware(mockRouter, history)
    const store = createStore(reducer, applyMiddleware(middleware))

    expect(store.getState()).toBe(null)
    store.dispatch(replace('item', { itemId: '123' }))
    expect(store.getState()).toBe('123')
    store.dispatch(replace('home'))
    expect(store.getState()).toBe(null)
  })

  test('isRouteAction() creates a route-specific action predicate', () => {
    const isCartAction = isRouteAction('cart')

    expect(isCartAction(routeChanged('home'))).toBe(false)
    expect(isCartAction(routeChanged('cart'))).toBe(true)
  })
})

describe('side effects', () => {
  test('dispatching SYNC action dispatches ROUTE_CHANGED action for current location', () => {
    const historyOptions = { initialEntries: ['/item/123'] }
    const { store } = mocks({ historyOptions })
    const action = routeChanged('item', { itemId: '123' }, '')

    store.dispatch(sync())
    expect(store.getActions()).toEqual([action])
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
    const { store, window } = mocks()

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

describe('an error is thrown', () => {
  test('when putting a Router in a Router', () => {
    expect(() => Router([Router([])])).toThrow()
  })

  test("when navigating to a route that doesn't exist", () => {
    const { store } = mocks()
    expect(() => store.dispatch(replace('nonsense'))).toThrow()
  })

  test("when location doesn't match a route", () => {
    const { history } = mocks({ router: Router([]) })
    expect(() => history.replace('/nonsense')).toThrow()
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
    test(`dispatches correct action when changed to '${path}'`, () => {
      const { store, history } = mocks()
      const action = routeChanged(route, params, hash)

      history.replace(path)
      expect(store.getActions()).toEqual([action])
    })
  })
})

describe('dispatching an action', () => {
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
      expect(createPath(history.location)).toBe(path)
    })
  })
})
