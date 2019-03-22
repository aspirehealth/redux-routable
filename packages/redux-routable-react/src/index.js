import { createPath } from 'history'
import PropTypes from 'prop-types'
import React, { createContext, useContext } from 'react'
import { Router, routeToLocation } from 'redux-routable'

const RouterContext = createContext()

// RouterProvider
export const RouterProvider = ({ router, children }) => (
  <RouterContext.Provider value={router}>{children}</RouterContext.Provider>
)

RouterProvider.propTypes = {
  router: PropTypes.instanceOf(Router).isRequired,
  children: PropTypes.node,
}

// Link
export const Link = ({
  component: Component,
  action,
  route,
  params,
  hash,
  ...props
}) => {
  const router = useContext(RouterContext)
  const location = routeToLocation(router, route, params, hash)
  const href = createPath(location)

  return <Component {...props} href={href} />
}

Link.propTypes = {
  component: PropTypes.oneOfType([PropTypes.string, PropTypes.func]),
  action: PropTypes.oneOf(['push', 'replace', 'open']),
  route: PropTypes.string.isRequired,
  params: PropTypes.objectOf(PropTypes.string),
  hash: PropTypes.string,
}

Link.defaultProps = {
  component: 'a',
  action: 'push',
  params: {},
  hash: '',
}
