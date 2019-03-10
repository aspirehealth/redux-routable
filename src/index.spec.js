import { createMemoryHistory } from 'history'
import configureStore from 'redux-mock-store'
import {
  Fallback,
  Redirect,
  Route,
  Router,
  Scope,
  createMiddleware,
  replace,
  routeChanged,
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

  return { store, history }
}

const LOCATION_CHANGE_TESTS = [
  ['', 'home', {}],
  ['/', 'home', {}],
  ['/cart', 'cart', {}],
  ['/search', 'search', {}],
  ['/search?query=devices', 'search', { query: 'devices' }],
  ['/search/widgets', 'search', { category: 'widgets' }],
  ['/item/123', 'item', { itemId: '123' }],
  ['/item', 'notFound', {}],
  ['/product/123', 'item', { itemId: '123' }],
  ['/users', 'users', {}],
  ['/users/456', 'user', { userId: '456' }],
  ['/users/admin', 'userAdmin', {}],
  ['/accounts', 'users', {}],
  ['/accounts/456', 'user', { userId: '456' }],
  ['/accounts/admin', 'userAdmin', {}],
  ['/nonsense', 'notFound', {}],
]

describe('changing the location', () => {
  LOCATION_CHANGE_TESTS.forEach(([path, route, params]) => {
    test(`dispatches correct action when changed to '${path}'`, () => {
      const { store, history } = mocks()
      const actions = [routeChanged(route, params)]

      history.replace(path)
      expect(store.getActions()).toEqual(actions)
    })
  })
})

const ACTION_DISPATCH_TESTS = [
  ['home', undefined, '/'],
  ['cart', undefined, '/cart'],
  ['search', undefined, '/search'],
  ['search', { query: 'devices' }, '/search?query=devices'],
  ['search', { category: 'widgets' }, '/search/widgets'],
  ['item', { itemId: '123' }, '/item/123'],
  ['users', undefined, '/users'],
  ['user', { userId: '456' }, '/users/456'],
  ['userAdmin', undefined, '/users/admin'],
]

describe('dispatching an action', () => {
  ACTION_DISPATCH_TESTS.forEach(([route, params, path]) => {
    test(`changes location to '${path}'`, () => {
      const { store, history } = mocks()

      store.dispatch(replace(route, params))
      expect(history.location.pathname + history.location.search).toBe(path)
    })
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
