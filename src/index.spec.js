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
  push,
  replace,
  routeChanged,
  routeReducer,
  sync,
} from './index'

const usersRouter = Router([
  Route('users'),
  Route('userAdmin', '/admin'),
  Route('user', '/:userId'),
])

const accountsRouter = Router([
  Redirect('users'),
  Redirect('userAdmin', '/admin'),
  Redirect('user', '/:userId'),
])

const mockRouter = Router([
  Route('home', '/'),
  Route('cart', '/cart'),
  Route('search', '/search/:category?'),
  Route('item', '/item/:itemId'),
  Redirect('item', '/product/:itemId'),
  Scope('/users', usersRouter),
  Scope('/accounts', accountsRouter),
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
})

describe('helpers', () => {
  test('routeReducer() creates a route-specific reducer', () => {
    const reducer = routeReducer(
      'item',
      (state, { payload }) => payload.params.itemId,
    )

    const history = createMemoryHistory()
    const middleware = createMiddleware(mockRouter, history)
    const store = createStore(reducer, applyMiddleware(middleware))

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
  test('when putting a Fallback in a Scope', () => {
    expect(() => Scope('/test', Router([Fallback('test')]))).toThrow()
  })

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
    ['/users', 'users', {}, ''],
    ['/users/456', 'user', { userId: '456' }, ''],
    ['/users/admin', 'userAdmin', {}, ''],
    ['/accounts', 'users', {}, ''],
    ['/accounts/456', 'user', { userId: '456' }, ''],
    ['/accounts/admin', 'userAdmin', {}, ''],
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
    ['users', undefined, undefined, '/users'],
    ['user', { userId: '456' }, undefined, '/users/456'],
    ['userAdmin', undefined, undefined, '/users/admin'],
  ]

  tests.forEach(([route, params, hash, path]) => {
    test(`changes location to '${path}'`, () => {
      const { store, history } = mocks()

      store.dispatch(replace(route, params, hash))
      expect(createPath(history.location)).toBe(path)
    })
  })
})
