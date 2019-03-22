import { createMemoryHistory } from 'history'
import React from 'react'
import { Provider } from 'react-redux'
import TestRenderer from 'react-test-renderer'
import configureStore from 'redux-mock-store'
import { Route, Router, createMiddleware, routeChanged } from 'redux-routable'
import { Link, RouterProvider } from './index'

const mockRouter = Router([
  Route('home', '/'),
  Route('search', '/search/:category?'),
])

const mocks = ({ router = mockRouter } = {}) => {
  const history = createMemoryHistory()
  const middleware = createMiddleware(router, history)
  const store = configureStore([middleware])()
  const create = children =>
    TestRenderer.create(
      <Provider store={store}>
        <RouterProvider router={router}>{children}</RouterProvider>
      </Provider>,
    ).toJSON()

  window.open = jest.fn()

  return { store, history, window, create }
}

describe('Link', () => {
  test('renders <a> element by default', () => {
    const { create } = mocks()
    const link = create(<Link route="home" />)

    expect(link.type).toBe('a')
  })

  test('renders custom component', () => {
    const { create } = mocks()
    const link = create(<Link component="div" route="home" />)

    expect(link.type).toBe('div')
  })

  test('generates correct href', () => {
    const { create } = mocks()
    const link = create(
      <Link
        route="search"
        params={{ category: 'widgets', query: 'devices' }}
        hash="#items"
      />,
    )

    expect(link.props.href).toBe('/search/widgets?query=devices#items')
  })

  test('allows other props to pass through', () => {
    const { create } = mocks()
    const link = create(<Link route="home" extra="extra" />)

    expect(link.props.extra).toBe('extra')
  })

  test('dispatches ROUTE_CHANGED action when clicked', () => {
    const { store, create } = mocks()
    const action = routeChanged('search', { category: 'widgets' }, '')
    const link = create(
      <Link route="search" params={{ category: 'widgets' }} />,
    )

    link.props.onClick()

    expect(store.getActions()).toEqual([action])
  })

  test('calls window.open() when clicked', () => {
    const { create, window } = mocks()
    const link = create(<Link route="home" action="open" />)

    link.props.onClick()

    expect(window.open).toHaveBeenCalled()
  })
})
